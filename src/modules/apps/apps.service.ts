import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import {
  oauthClientService,
  auditService,
} from '../../storage/database/services';
import { getSupabaseClient } from '../../storage/database/supabase-client';
import type { OAuthClient } from '../../storage/database/shared/schema';

// 加密密钥（生产环境应从环境变量获取）
const ENCRYPTION_KEY =
  process.env.SECRET_ENCRYPTION_KEY || 'idc-default-encryption-key-32b!';

// 加密函数
function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

// 解密函数
function decrypt(encryptedText: string): string | null {
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 2) return null;
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return null;
  }
}

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

    // 加密明文密钥用于存储
    const encryptedSecret = encrypt(clientSecret);

    const insertData: any = {
      name: data.name,
      client_id: clientId,
      client_secret: hashedSecret, // bcrypt hash 用于快速验证
      redirect_uris: data.redirectUris,
      scopes: data.scopes || ['openid', 'profile', 'email'],
      grant_types: ['authorization_code', 'refresh_token'],
      status: 'active',
      tenant_id: data.tenantId,
      client_secret_plain: encryptedSecret, // 加密后的明文密钥
    };

    const app = await oauthClientService.create(insertData);

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
  async validateClient(
    clientId: string,
    clientSecret: string,
    redirectUri: string,
  ): Promise<OAuthClient> {
    const app = await oauthClientService.findByClientId(clientId);
    if (!app) {
      throw new Error('客户端不存在');
    }

    if (app.status !== 'active') {
      throw new Error('客户端已被禁用');
    }

    if (
      !Array.isArray(app.redirect_uris) ||
      !app.redirect_uris.includes(redirectUri)
    ) {
      throw new Error('未授权的回调地址');
    }

    // 验证密钥
    if (!app.client_secret) {
      throw new Error('客户端未配置密钥');
    }
    const isValid = await bcrypt.compare(clientSecret, app.client_secret);
    if (!isValid) {
      throw new Error('客户端密钥错误');
    }

    return app;
  }

  // 获取应用（管理员）- 包含明文密钥
  async getAppForAdmin(
    clientId: string,
  ): Promise<{ app: OAuthClient; clientSecret?: string }> {
    const app = await oauthClientService.findByClientId(clientId);
    if (!app) {
      throw new Error('应用不存在');
    }

    // 直接使用 app 中的 client_secret_plain 字段（如果存在）
    // 如果没有，尝试解密或返回 undefined
    let clientSecret: string | undefined;

    if ((app as any).client_secret_plain) {
      // 尝试解密（如果是加密格式）
      const plain = (app as any).client_secret_plain as string;
      if (plain.includes(':')) {
        // 加密格式，尝试解密
        const decrypted = decrypt(plain);
        if (decrypted) {
          clientSecret = decrypted;
        }
      } else {
        // 明文格式，直接使用
        clientSecret = plain;
      }
    }

    return { app, clientSecret };
  }

  // 删除应用
  async deleteApp(clientId: string, tenantId?: string): Promise<void> {
    await oauthClientService.deleteByClientId(clientId, tenantId);
  }

  // 更新应用
  async updateApp(
    clientId: string,
    data: { name?: string; redirectUris?: string[]; scopes?: string[] },
    tenantId?: string,
  ): Promise<OAuthClient> {
    const updateData: any = {};
    if (data.name) updateData.name = data.name;
    if (data.redirectUris) updateData.redirect_uris = data.redirectUris;
    if (data.scopes) updateData.scopes = data.scopes;

    return oauthClientService.update(clientId, updateData, tenantId);
  }

  // 重新生成密钥
  async regenerateSecret(clientId: string): Promise<{ clientSecret: string }> {
    const app = await oauthClientService.findByClientId(clientId);
    if (!app) {
      throw new Error('应用不存在');
    }

    // 生成新密钥
    const newSecret = crypto.randomBytes(32).toString('hex');
    const hashedSecret = await bcrypt.hash(newSecret, 12);
    const encryptedSecret = encrypt(newSecret);

    // 更新数据库
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('oauth_clients')
      .update({
        client_secret: hashedSecret,
        client_secret_plain: encryptedSecret,
      })
      .eq('client_id', clientId);

    if (error) {
      throw new Error(`更新密钥失败: ${error.message}`);
    }

    return { clientSecret: newSecret };
  }
}

export const appsService = new AppsService();
