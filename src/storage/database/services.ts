import { getSupabaseClient } from './supabase-client';
import * as bcrypt from 'bcryptjs';
import type { User, Tenant, OAuthClient, AuditLog, ThirdPartyAccount, UserSession } from './shared/schema';

// 用户服务
export class UserService {
  private client = getSupabaseClient();

  async create(data: any): Promise<User> {
    const { data: user, error } = await this.client.from('users').insert(data).select().single();
    if (error) throw new Error(`创建用户失败: ${error.message}`);
    return user as User;
  }

  async findById(id: string): Promise<User | null> {
    const { data, error } = await this.client.from('users').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(`查询用户失败: ${error.message}`);
    return data as User | null;
  }

  async findByUsername(username: string): Promise<User | null> {
    const { data, error } = await this.client.from('users').select('*').eq('username', username).maybeSingle();
    if (error) throw new Error(`查询用户失败: ${error.message}`);
    return data as User | null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const { data, error } = await this.client.from('users').select('*').eq('email', email).maybeSingle();
    if (error) throw new Error(`查询用户失败: ${error.message}`);
    return data as User | null;
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    const { data: user, error } = await this.client.from('users').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id).select().single();
    if (error) throw new Error(`更新用户失败: ${error.message}`);
    return user as User;
  }

  async verifyPassword(user: User, password: string): Promise<boolean> {
    if (!user.password_hash) return false;
    return bcrypt.compare(password, user.password_hash);
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  async updateLoginInfo(id: string, ipAddress: string): Promise<void> {
    await this.client.from('users').update({
      last_login_at: new Date().toISOString(),
      last_login_ip: ipAddress,
    }).eq('id', id);
  }
}

// 租户服务
export class TenantService {
  private client = getSupabaseClient();

  async create(data: { name: string; slug: string }): Promise<Tenant> {
    // 先检查 slug 是否已存在
    const existing = await this.findBySlug(data.slug);
    if (existing) {
      throw new Error('该租户标识已被使用');
    }
    const { data: tenant, error } = await this.client.from('tenants').insert(data).select().single();
    if (error) {
      // 可能是数据库层面的唯一约束冲突
      if (error.code === '23505') {
        throw new Error('该租户标识已被使用');
      }
      throw new Error(`创建租户失败: ${error.message}`);
    }
    return tenant as Tenant;
  }

  async findById(id: string): Promise<Tenant | null> {
    const { data, error } = await this.client.from('tenants').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(`查询租户失败: ${error.message}`);
    return data as Tenant | null;
  }

  async findBySlug(slug: string): Promise<Tenant | null> {
    const { data, error } = await this.client.from('tenants').select('*').eq('slug', slug).maybeSingle();
    if (error) throw new Error(`查询租户失败: ${error.message}`);
    return data as Tenant | null;
  }

  async findAll(): Promise<Tenant[]> {
    const { data, error } = await this.client.from('tenants').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(`查询租户列表失败: ${error.message}`);
    return (data || []) as Tenant[];
  }
}

// OAuth 客户端服务
export class OAuthClientService {
  private client = getSupabaseClient();

  async create(data: any): Promise<OAuthClient> {
    const { data: oauthClient, error } = await this.client.from('oauth_clients').insert(data).select().single();
    if (error) throw new Error(`创建OAuth客户端失败: ${error.message}`);
    return oauthClient as OAuthClient;
  }

  async findByClientId(clientId: string): Promise<OAuthClient | null> {
    const { data, error } = await this.client.from('oauth_clients').select('*').eq('client_id', clientId).maybeSingle();
    if (error) throw new Error(`查询OAuth客户端失败: ${error.message}`);
    return data as OAuthClient | null;
  }

  async findById(id: string): Promise<OAuthClient | null> {
    const { data, error } = await this.client.from('oauth_clients').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(`查询OAuth客户端失败: ${error.message}`);
    return data as OAuthClient | null;
  }

  async findAll(tenantId?: string): Promise<OAuthClient[]> {
    let query = this.client.from('oauth_clients').select('*').order('created_at', { ascending: false });
    // 只有当 tenantId 有效（不是 'default' 且不是 undefined）时才过滤
    if (tenantId && tenantId !== 'default') {
      query = query.eq('tenant_id', tenantId);
    }
    const { data, error } = await query;
    if (error) throw new Error(`查询OAuth客户端列表失败: ${error.message}`);
    return (data || []) as OAuthClient[];
  }

  async verifySecret(client: OAuthClient, secret: string): Promise<boolean> {
    return bcrypt.compare(secret, client.client_secret);
  }

  async deleteByClientId(clientId: string, tenantId?: string): Promise<void> {
    let query = this.client.from('oauth_clients').delete().eq('client_id', clientId);
    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }
    const { error } = await query;
    if (error) throw new Error(`删除OAuth客户端失败: ${error.message}`);
  }

  async update(clientId: string, data: any, tenantId?: string): Promise<OAuthClient> {
    const conditions: any = { client_id: clientId };
    if (tenantId) conditions.tenant_id = tenantId;
    
    const { data: updated, error } = await this.client
      .from('oauth_clients')
      .update(data)
      .match(conditions)
      .select()
      .single();
    if (error) throw new Error(`更新OAuth客户端失败: ${error.message}`);
    return updated as OAuthClient;
  }
}

// 会话服务
export class SessionService {
  private client = getSupabaseClient();

  async create(data: any): Promise<UserSession> {
    const { data: session, error } = await this.client.from('user_sessions').insert(data).select().single();
    if (error) throw new Error(`创建会话失败: ${error.message}`);
    return session as UserSession;
  }

  async findByAccessToken(accessToken: string): Promise<UserSession | null> {
    const { data, error } = await this.client.from('user_sessions').select('*').eq('access_token', accessToken).maybeSingle();
    if (error) throw new Error(`查询会话失败: ${error.message}`);
    return data as UserSession | null;
  }

  async findByRefreshToken(refreshToken: string): Promise<UserSession | null> {
    const { data, error } = await this.client.from('user_sessions').select('*').eq('refresh_token', refreshToken).maybeSingle();
    if (error) throw new Error(`查询会话失败: ${error.message}`);
    return data as UserSession | null;
  }

  async delete(accessToken: string): Promise<void> {
    const { error } = await this.client.from('user_sessions').delete().eq('access_token', accessToken);
    if (error) throw new Error(`删除会话失败: ${error.message}`);
  }

  async deleteByUserId(userId: string): Promise<void> {
    const { error } = await this.client.from('user_sessions').delete().eq('user_id', userId);
    if (error) throw new Error(`删除用户会话失败: ${error.message}`);
  }

  async cleanExpired(): Promise<void> {
    const { error } = await this.client.from('user_sessions').delete().lt('expires_at', new Date().toISOString());
    if (error) throw new Error(`清理过期会话失败: ${error.message}`);
  }
}

// 审计日志服务
export class AuditService {
  private client = getSupabaseClient();

  async create(data: any): Promise<void> {
    try {
      const { error } = await this.client.from('audit_logs').insert(data);
      if (error) {
        console.warn('审计日志记录失败:', error.message);
      }
    } catch (err) {
      // 静默失败，不影响主流程
      console.warn('审计日志记录异常:', err);
    }
  }

  async query(params: {
    eventType?: string;
    userId?: string;
    clientId?: string;
    startTime?: string;
    endTime?: string;
    page?: number;
    pageSize?: number;
    tenantId?: string;
  }): Promise<{ list: AuditLog[]; total: number }> {
    let query = this.client.from('audit_logs').select('*', { count: 'exact' });
    
    if (params.tenantId) query = query.eq('tenant_id', params.tenantId);
    if (params.eventType) query = query.eq('event_type', params.eventType);
    if (params.userId) query = query.eq('user_id', params.userId);
    if (params.clientId) query = query.eq('client_id', params.clientId);
    if (params.startTime && params.endTime) {
      query = query.gte('created_at', params.startTime).lte('created_at', params.endTime);
    }

    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    query = query.order('created_at', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);

    const { data, error, count } = await query;
    if (error) throw new Error(`查询审计日志失败: ${error.message}`);
    return { list: (data || []) as AuditLog[], total: count || 0 };
  }
}

// 第三方账户服务
export class ThirdPartyService {
  private client = getSupabaseClient();

  async create(data: any): Promise<ThirdPartyAccount> {
    const { data: account, error } = await this.client.from('third_party_accounts').insert(data).select().single();
    if (error) throw new Error(`创建第三方账户失败: ${error.message}`);
    return account as ThirdPartyAccount;
  }

  async findByProvider(provider: string, providerUserId: string): Promise<ThirdPartyAccount | null> {
    const { data, error } = await this.client
      .from('third_party_accounts')
      .select('*, users(*)')
      .eq('provider', provider)
      .eq('provider_user_id', providerUserId)
      .maybeSingle();
    if (error) throw new Error(`查询第三方账户失败: ${error.message}`);
    return data as ThirdPartyAccount | null;
  }

  async findByUserId(userId: string): Promise<ThirdPartyAccount[]> {
    const { data, error } = await this.client.from('third_party_accounts').select('*').eq('user_id', userId);
    if (error) throw new Error(`查询用户第三方账户失败: ${error.message}`);
    return (data || []) as ThirdPartyAccount[];
  }

  async delete(userId: string, provider: string): Promise<void> {
    const { error } = await this.client.from('third_party_accounts').delete().eq('user_id', userId).eq('provider', provider);
    if (error) throw new Error(`删除第三方账户失败: ${error.message}`);
  }

  async upsert(data: any): Promise<ThirdPartyAccount> {
    const { data: account, error } = await this.client
      .from('third_party_accounts')
      .upsert(data, { onConflict: 'provider,provider_user_id' })
      .select()
      .single();
    if (error) throw new Error(`更新第三方账户失败: ${error.message}`);
    return account as ThirdPartyAccount;
  }
}

// 导出服务实例
export const userService = new UserService();
export const tenantService = new TenantService();
export const oauthClientService = new OAuthClientService();
export const sessionService = new SessionService();
export const auditService = new AuditService();
export const thirdPartyService = new ThirdPartyService();
