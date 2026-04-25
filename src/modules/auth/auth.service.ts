import * as crypto from 'crypto';
import { getSupabaseClient } from '../../storage/database/supabase-client';
import {
  userService,
  oauthClientService,
  sessionService,
  auditService,
} from '../../storage/database/services';
import type {
  User,
  OAuthClient,
  UserSession,
} from '../../storage/database/shared/schema';

export class AuthService {
  private client = getSupabaseClient();

  // 生成授权码（简化版，实际应用中需要存储到缓存中并设置过期时间）
  async generateAuthorizationCode(
    clientId: string,
    redirectUri: string,
    userId: string,
    scopes: string[],
  ): Promise<{ code: string; state?: string }> {
    const code = crypto.randomBytes(32).toString('hex');
    const state = crypto.randomBytes(16).toString('hex');

    // 将授权码存入缓存（5分钟过期）
    const codeData = JSON.stringify({ clientId, redirectUri, userId, scopes });
    await sessionService.create({
      user_id: userId,
      token_hash: `code_${code}`,
      refresh_token_hash: codeData,
      ip_address: '',
      user_agent: '',
      expires_at: new Date(Date.now() + 5 * 60 * 1000),
    });

    return { code, state };
  }

  // 验证授权码并颁发 Token
  async exchangeCodeForToken(
    code: string,
    clientId: string,
    redirectUri: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    tokenType: string;
  }> {
    // 查找授权码会话
    const session = await sessionService.findByAccessToken(`code_${code}`);

    if (!session) {
      throw new Error('无效的授权码');
    }

    const codeData = JSON.parse(session.refresh_token || '{}');
    if (
      codeData.clientId !== clientId ||
      codeData.redirectUri !== redirectUri
    ) {
      throw new Error('授权码验证失败');
    }

    // 删除授权码
    await this.client
      .from('user_sessions')
      .delete()
      .eq('access_token', `code_${code}`);

    // 生成 Access Token 和 Refresh Token
    const accessToken = `at_${crypto.randomUUID()}`;
    const refreshToken = `rt_${crypto.randomUUID()}`;
    const expiresIn = 3600; // 1小时
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    // 创建会话
    await sessionService.create({
      user_id: codeData.userId,
      token_hash: accessToken,
      refresh_token_hash: refreshToken,
      ip_address: '',
      user_agent: '',
      expires_at: expiresAt,
    });

    // 记录审计日志
    await auditService.create({
      event_type: 'oauth_token',
      user_id: codeData.userId,
      client_id: clientId,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn,
      tokenType: 'Bearer',
    };
  }

  // 刷新 Access Token
  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    tokenType: string;
  }> {
    const session = await sessionService.findByRefreshToken(refreshToken);
    if (!session) {
      throw new Error('无效的 Refresh Token');
    }

    // 生成新的 Token
    const accessToken = `at_${crypto.randomUUID()}`;
    const newRefreshToken = `rt_${crypto.randomUUID()}`;
    const expiresIn = 3600;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    // 更新会话
    await this.client
      .from('user_sessions')
      .update({
        access_token: accessToken,
        refresh_token: newRefreshToken,
        expires_at: expiresAt.toISOString(),
      })
      .eq('refresh_token', refreshToken);

    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn,
      tokenType: 'Bearer',
    };
  }

  // 验证 Token
  async introspectToken(
    accessToken: string,
  ): Promise<{ active: boolean; sub?: string; exp?: number }> {
    const session = await sessionService.findByAccessToken(accessToken);
    if (!session) {
      return { active: false };
    }

    const expiresAt = new Date(session.expires_at);
    if (expiresAt < new Date()) {
      await sessionService.delete(accessToken);
      return { active: false };
    }

    return {
      active: true,
      sub: session.user_id,
      exp: expiresAt.getTime() / 1000,
    };
  }

  // 获取用户信息
  async getUserInfo(accessToken: string): Promise<Partial<User>> {
    const session = await sessionService.findByAccessToken(accessToken);
    if (!session) {
      throw new Error('无效的 Token');
    }

    const user = await userService.findById(session.user_id);
    if (!user) {
      throw new Error('用户不存在');
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      nickname: user.nickname,
      avatar: user.avatar,
    };
  }

  // 撤销 Token
  async revokeToken(accessToken: string): Promise<void> {
    await sessionService.delete(accessToken);
  }

  // 登出
  async logout(
    accessToken: string,
    userId: string,
    ipAddress: string,
    userAgent?: string,
  ): Promise<void> {
    await sessionService.delete(accessToken);
    await auditService.create({
      event_type: 'logout',
      user_id: userId,
      ip_address: ipAddress,
      user_agent: userAgent,
    });
  }
}

export const authService = new AuthService();
