import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import { oauthClientService, auditService } from '../../storage/database/services';
import { secretStorage } from '../../storage/secret-storage';
import type { OAuthClient } from '../../storage/database/shared/schema';

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
    const hashedSecret = await bcrypt.hash(clientSecret, 12);

    const insertData: any = {
      name: data.name,
      client_id: clientId,
      client_secret: hashedSecret, // 仍然存储 hash 用于快速验证
      redirect_uris: data.redirectUris,
      scopes: data.scopes || ['openid', 'profile', 'email'],
      grant_types: ['authorization_code', 'refresh_token'],
      status: 'active',
    };
    
    // 只有当 tenantId 有效时才设置
    if (data.tenantId && data.tenantId !== 'default') {
      insertData.tenant_id = data.tenantId;
    }

    const app = await oauthClientService.create(insertData);

    // 将明文密钥存储到对象存储（用于管理员查看/导出）
    try {
      await secretStorage.storeClientSecret(clientId, clientSecret);
    } catch (error) {
      console.error('存储 client_secret 到对象存储失败:', error);
      // 不影响主流程，密钥仍可使用
    }

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

    if (!Array.isArray(app.redirect_uris) || !app.redirect_uris.includes(redirectUri)) {
      throw new Error('未授权的回调地址');
    }

    // 验证密钥
    const isValid = await bcrypt.compare(clientSecret, app.client_secret);
    if (!isValid) {
      throw new Error('客户端密钥错误');
    }

    return app;
  }

  // 获取应用（管理员）
  async getAppForAdmin(clientId: string): Promise<{ app: OAuthClient; clientSecret?: string }> {
    const app = await oauthClientService.findByClientId(clientId);
    if (!app) {
      throw new Error('应用不存在');
    }

    // 获取明文密钥
    let clientSecret: string | undefined;
    try {
      clientSecret = await secretStorage.getClientSecret(clientId) || undefined;
    } catch (error) {
      console.error('从对象存储获取 client_secret 失败:', error);
    }

    return { app, clientSecret };
  }

  // 删除应用
  async deleteApp(clientId: string, tenantId?: string): Promise<void> {
    await oauthClientService.deleteByClientId(clientId, tenantId);
    
    // 删除对象存储中的密钥
    try {
      await secretStorage.deleteClientSecret(clientId);
    } catch (error) {
      console.error('删除对象存储中的 client_secret 失败:', error);
    }
  }

  // 更新应用
  async updateApp(clientId: string, data: { name?: string; redirectUris?: string[]; scopes?: string[] }, tenantId?: string): Promise<OAuthClient> {
    const updateData: any = {};
    if (data.name) updateData.name = data.name;
    if (data.redirectUris) updateData.redirect_uris = data.redirectUris;
    if (data.scopes) updateData.scopes = data.scopes;
    
    return oauthClientService.update(clientId, updateData, tenantId);
  }
}

export const appsService = new AppsService();
