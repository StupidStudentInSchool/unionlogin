import * as crypto from 'crypto';
import { oauthClientService, auditService } from '../../storage/database/services';
import { getSupabaseClient } from '../../storage/database/supabase-client';
import type { OAuthClient, InsertOAuthClient } from '../../storage/database/shared/schema';

export class AppsService {
  // 创建应用
  async createApp(data: {
    name: string;
    redirectUris: string[];
    scopes?: string[];
    tenantId?: string;
  }): Promise<{ app: OAuthClient; clientSecret: string }> {
    const clientId = crypto.randomBytes(16).toString('hex');
    const clientSecret = crypto.randomBytes(32).toString('hex');
    const hashedSecret = await require('bcryptjs').hash(clientSecret, 12);

    const app = await oauthClientService.create({
      name: data.name,
      client_id: clientId,
      client_secret: hashedSecret,
      redirect_uris: data.redirectUris,
      scopes: data.scopes || ['openid', 'profile', 'email'],
      grant_types: ['authorization_code', 'refresh_token'],
      tenant_id: data.tenantId,
      status: 'active',
    } as any);

    return { app, clientSecret };
  }

  // 获取应用列表
  async getApps(tenantId?: string): Promise<OAuthClient[]> {
    return oauthClientService.findAll(tenantId);
  }

  // 获取应用详情
  async getApp(clientId: string): Promise<OAuthClient> {
    const app = await oauthClientService.findByClientId(clientId);
    if (!app) {
      throw new Error('应用不存在');
    }
    return app;
  }

  // 验证客户端
  async validateClient(clientId: string, clientSecret: string, redirectUri: string): Promise<OAuthClient> {
    const app = await oauthClientService.findByClientId(clientId);
    if (!app) {
      throw new Error('客户端不存在');
    }

    if (app.status !== 'active') {
      throw new Error('客户端已被禁用');
    }

    // 验证密钥
    const isValid = await oauthClientService.verifySecret(app, clientSecret);
    if (!isValid) {
      throw new Error('客户端密钥错误');
    }

    // 验证 redirect_uri
    const validUris = app.redirect_uris as string[];
    if (!validUris.includes(redirectUri)) {
      throw new Error('redirect_uri 不匹配');
    }

    await auditService.create({
      event_type: 'oauth_authorize',
      client_id: app.id,
    });

    return app;
  }

  // 删除应用
  async deleteApp(clientId: string, tenantId?: string): Promise<void> {
    const app = await oauthClientService.findByClientId(clientId);
    if (!app) {
      throw new Error('应用不存在');
    }

    if (tenantId && app.tenant_id !== tenantId) {
      throw new Error('无权删除此应用');
    }

    const client = getSupabaseClient();
    await client.from('oauth_clients').delete().eq('client_id', clientId);
  }

  // 更新应用
  async updateApp(clientId: string, data: {
    name?: string;
    redirectUris?: string[];
    scopes?: string[];
  }, tenantId?: string): Promise<OAuthClient> {
    const app = await oauthClientService.findByClientId(clientId);
    if (!app) {
      throw new Error('应用不存在');
    }

    if (tenantId && app.tenant_id !== tenantId) {
      throw new Error('无权修改此应用');
    }

    const client = getSupabaseClient();
    const updateData: any = { updated_at: new Date().toISOString() };
    if (data.name) updateData.name = data.name;
    if (data.redirectUris) updateData.redirect_uris = data.redirectUris;
    if (data.scopes) updateData.scopes = data.scopes;

    const { data: updated, error } = await client.from('oauth_clients').update(updateData).eq('client_id', clientId).select().single();
    if (error) throw new Error(`更新应用失败: ${error.message}`);
    
    return updated as OAuthClient;
  }
}

export const appsService = new AppsService();
