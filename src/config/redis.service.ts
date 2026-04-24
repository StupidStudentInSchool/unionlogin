import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const host = this.configService.get<string>('redis.host') || 'localhost';
    const port = this.configService.get<number>('redis.port') || 6379;
    const password = this.configService.get<string>('redis.password');
    const db = this.configService.get<number>('redis.db') || 0;

    this.client = new Redis({
      host,
      port,
      password: password || undefined,
      db,
      maxRetriesPerRequest: 3,
    });

    this.client.on('error', (err) => {
      console.error('Redis connection error:', err);
    });

    this.client.on('connect', () => {
      console.log('Redis connected successfully');
    });
  }

  onModuleDestroy() {
    if (this.client) {
      this.client.disconnect();
    }
  }

  getClient(): Redis {
    return this.client;
  }

  // String 操作
  async set(key: string, value: string, expireSeconds?: number): Promise<void> {
    if (expireSeconds) {
      await this.client.set(key, value, 'EX', expireSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  // Hash 操作
  async hset(key: string, field: string, value: string): Promise<void> {
    await this.client.hset(key, field, value);
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.client.hget(key, field);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return this.client.hgetall(key);
  }

  async hdel(key: string, field: string): Promise<void> {
    await this.client.hdel(key, field);
  }

  // Token 相关操作
  async setAccessToken(token: string, userId: string, expireSeconds: number): Promise<void> {
    await this.set(`access_token:${token}`, userId, expireSeconds);
    await this.client.sadd(`user_tokens:${userId}`, token);
  }

  async getAccessToken(token: string): Promise<string | null> {
    return this.get(`access_token:${token}`);
  }

  async revokeAccessToken(token: string): Promise<void> {
    const userId = await this.get(`access_token:${token}`);
    await this.del(`access_token:${token}`);
    if (userId) {
      await this.client.srem(`user_tokens:${userId}`, token);
    }
  }

  async setRefreshToken(token: string, userId: string, expireSeconds: number): Promise<void> {
    await this.set(`refresh_token:${token}`, userId, expireSeconds);
  }

  async getRefreshToken(token: string): Promise<string | null> {
    return this.get(`refresh_token:${token}`);
  }

  async revokeRefreshToken(token: string): Promise<void> {
    await this.del(`refresh_token:${token}`);
  }

  // 授权码操作
  async setAuthorizationCode(code: string, data: Record<string, any>, expireSeconds: number): Promise<void> {
    await this.set(`auth_code:${code}`, JSON.stringify(data), expireSeconds);
  }

  async getAuthorizationCode(code: string): Promise<Record<string, any> | null> {
    const data = await this.get(`auth_code:${code}`);
    return data ? JSON.parse(data) : null;
  }

  async revokeAuthorizationCode(code: string): Promise<void> {
    await this.del(`auth_code:${code}`);
  }

  // 会话操作
  async setSession(sessionId: string, data: Record<string, any>, expireSeconds: number): Promise<void> {
    await this.set(`session:${sessionId}`, JSON.stringify(data), expireSeconds);
  }

  async getSession(sessionId: string): Promise<Record<string, any> | null> {
    const data = await this.get(`session:${sessionId}`);
    return data ? JSON.parse(data) : null;
  }

  async delSession(sessionId: string): Promise<void> {
    await this.del(`session:${sessionId}`);
  }

  // 用户会话管理（支持强制登出）
  async addUserSession(userId: string, sessionId: string, deviceInfo: string, expireSeconds: number): Promise<void> {
    await this.client.sadd(`user_sessions:${userId}`, sessionId);
    await this.set(`session_info:${sessionId}`, JSON.stringify({ userId, deviceInfo }), expireSeconds);
  }

  async getUserSessions(userId: string): Promise<Array<{ sessionId: string; deviceInfo: string }>> {
    const sessionIds = await this.client.smembers(`user_sessions:${userId}`);
    const sessions: Array<{ sessionId: string; deviceInfo: string }> = [];
    
    for (const sessionId of sessionIds) {
      const info = await this.getSession(sessionId);
      if (info) {
        sessions.push({ sessionId, deviceInfo: info.deviceInfo || '' });
      } else {
        // 清理失效的 session
        await this.client.srem(`user_sessions:${userId}`, sessionId);
      }
    }
    
    return sessions;
  }

  async revokeUserSession(userId: string, sessionId: string): Promise<void> {
    await this.client.srem(`user_sessions:${userId}`, sessionId);
    await this.delSession(sessionId);
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    const sessionIds = await this.client.smembers(`user_sessions:${userId}`);
    for (const sessionId of sessionIds) {
      await this.delSession(sessionId);
    }
    await this.client.del(`user_sessions:${userId}`);
  }
}
