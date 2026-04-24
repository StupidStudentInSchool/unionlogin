import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import { getSupabaseClient } from './supabase-client';
import { secretStorage } from '../secret-storage';
import type { User, Tenant, OAuthClient } from './shared/schema';

export class TransactionService {
  private client = getSupabaseClient();

  /**
   * 初始化租户（事务操作）
   * 包含：租户 + 用户 + 默认应用
   */
  async initializeTenant(data: {
    tenant: { name: string; slug: string };
    admin: { username: string; email: string; password: string };
  }): Promise<{
    tenant: Tenant;
    user: User;
    app?: OAuthClient;
    clientSecret?: string;
    accessToken?: string;
    refreshToken?: string;
  }> {
    const { tenant, admin } = data;
    const results: any = {};

    try {
      // 步骤1：创建租户
      const { data: newTenant, error: tenantError } = await this.client
        .from('tenants')
        .insert({ name: tenant.name, slug: tenant.slug })
        .select()
        .single();

      if (tenantError) {
        if (tenantError.code === '23505') {
          throw new Error('该租户标识已被使用');
        }
        throw new Error(`创建租户失败: ${tenantError.message}`);
      }
      results.tenant = newTenant;
      console.log('✅ 租户创建成功:', newTenant.id);

      // 步骤2：创建管理员用户（只使用 public.users 表的字段）
      const hashedPassword = await bcrypt.hash(admin.password, 12);
      const { data: newUser, error: userError } = await this.client
        .from('users')
        .insert({
          username: admin.username,
          email: admin.email,
          password_hash: hashedPassword,
          tenant_id: newTenant.id,
          status: 'active',
        })
        .select()
        .single();

      if (userError) {
        // 回滚：删除已创建的租户
        await this.rollback('tenants', newTenant.id);
        if (userError.code === '23505') {
          throw new Error('该用户名或邮箱已被使用');
        }
        throw new Error(`创建用户失败: ${userError.message}`);
      }
      results.user = newUser;
      console.log('✅ 用户创建成功:', newUser.id);

      // 步骤3：创建默认应用
      const clientId = crypto.randomBytes(16).toString('hex');
      const clientSecret = crypto.randomBytes(32).toString('hex');
      const hashedSecret = await bcrypt.hash(clientSecret, 12);

      const { data: newApp, error: appError } = await this.client
        .from('oauth_clients')
        .insert({
          name: 'Default Application',
          client_id: clientId,
          client_secret: hashedSecret,
          redirect_uris: ['http://localhost:3000/callback'],
          scopes: ['openid', 'profile', 'email'],
          grant_types: ['authorization_code', 'refresh_token'],
          status: 'active',
          tenant_id: newTenant.id,
        })
        .select()
        .single();

      if (appError) {
        // 回滚：删除已创建的租户和用户
        await this.rollback('users', newUser.id);
        await this.rollback('tenants', newTenant.id);
        throw new Error(`创建应用失败: ${appError.message}`);
      }
      results.app = newApp;
      console.log('✅ 应用创建成功:', newApp.id);

      // 步骤4：将 client_secret 存储到对象存储
      try {
        await secretStorage.storeClientSecret(clientId, clientSecret);
        results.clientSecret = clientSecret;
        console.log('✅ 密钥已存储到对象存储');
      } catch (storageError) {
        // 对象存储失败不影响主流程，但记录警告
        console.warn('⚠️ 密钥存储到对象存储失败:', storageError);
        results.clientSecret = clientSecret; // 仍然返回给用户
      }

      // 步骤5：创建用户 Session（用于 Token 验证）
      const accessToken = crypto.randomBytes(32).toString('hex');
      const refreshToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1小时后过期

      const { error: sessionError } = await this.client
        .from('user_sessions')
        .insert({
          user_id: newUser.id,
          tenant_id: newTenant.id,
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_at: expiresAt.toISOString(),
          ip_address: '0.0.0.0',
          user_agent: 'System',
        });

      if (sessionError) {
        console.warn('⚠️ 创建 session 失败:', sessionError.message);
      } else {
        results.accessToken = accessToken;
        results.refreshToken = refreshToken;
        console.log('✅ Session 创建成功');
      }

      return results;

    } catch (error: any) {
      console.error('❌ 初始化租户失败:', error.message);
      // 确保清理所有已创建的资源
      await this.cleanupPartialData(results);
      throw error;
    }
  }

  /**
   * 回滚操作（删除指定记录）
   */
  private async rollback(table: string, id: string): Promise<void> {
    try {
      const { error } = await this.client.from(table).delete().eq('id', id);
      if (error) {
        console.error(`⚠️ 回滚 ${table}:${id} 失败:`, error.message);
      } else {
        console.log(`🔄 已回滚 ${table}:${id}`);
      }
    } catch (err) {
      console.error(`⚠️ 回滚操作异常 ${table}:${id}:`, err);
    }
  }

  /**
   * 清理部分创建的数据
   */
  private async cleanupPartialData(results: any): Promise<void> {
    console.log('🧹 开始清理部分数据...');
    
    if (results.app?.client_id) {
      try {
        await secretStorage.deleteClientSecret(results.app.client_id);
        console.log('🔄 已删除对象存储中的密钥');
      } catch {}
    }

    if (results.app?.id) {
      await this.rollback('oauth_clients', results.app.id);
    }
    if (results.user?.id) {
      await this.rollback('users', results.user.id);
    }
    if (results.tenant?.id) {
      await this.rollback('tenants', results.tenant.id);
    }
    
    console.log('🧹 清理完成');
  }

  /**
   * 清理指定表的数据
   */
  async clearAll(): Promise<void> {
    await this.client.from('audit_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await this.client.from('user_sessions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await this.client.from('user_authorizations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await this.client.from('oauth_clients').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await this.client.from('users').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await this.client.from('tenants').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  }
}

export const transactionService = new TransactionService();
