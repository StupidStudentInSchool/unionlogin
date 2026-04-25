import { getSupabaseClient, createNewClient } from './supabase-client';
export { getSupabaseClient, createNewClient };
import * as bcrypt from 'bcryptjs';
import type {
  User,
  Tenant,
  OAuthClient,
  AuditLog,
  ThirdPartyAccount,
  UserSession,
} from './shared/schema';

// 用户服务
export class UserService {
  private client = getSupabaseClient();

  async create(data: any): Promise<User> {
    const { data: user, error } = await this.client
      .from('users')
      .insert(data)
      .select()
      .single();
    if (error) throw new Error(`创建用户失败: ${error.message}`);
    return user as User;
  }

  async findById(id: string): Promise<User | null> {
    const { data, error } = await this.client
      .from('users')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(`查询用户失败: ${error.message}`);
    return data as User | null;
  }

  async findByUsername(
    username: string,
    tenantId?: string,
  ): Promise<User | null> {
    let query = this.client.from('users').select('*').eq('username', username);
    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }
    const { data, error } = await query.maybeSingle();
    if (error) throw new Error(`查询用户失败: ${error.message}`);
    return data as User | null;
  }

  async findByEmail(email: string, tenantId?: string): Promise<User | null> {
    let query = this.client.from('users').select('*').eq('email', email);
    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }
    const { data, error } = await query.maybeSingle();
    if (error) throw new Error(`查询用户失败: ${error.message}`);
    return data as User | null;
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    const { data: user, error } = await this.client
      .from('users')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
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
    await this.client
      .from('users')
      .update({
        last_login_at: new Date().toISOString(),
        last_login_ip: ipAddress,
      })
      .eq('id', id);
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
    const { data: tenant, error } = await this.client
      .from('tenants')
      .insert(data)
      .select()
      .single();
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
    const { data, error } = await this.client
      .from('tenants')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(`查询租户失败: ${error.message}`);
    return data as Tenant | null;
  }

  async findBySlug(slug: string): Promise<Tenant | null> {
    const { data, error } = await this.client
      .from('tenants')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();
    if (error) throw new Error(`查询租户失败: ${error.message}`);
    return data as Tenant | null;
  }

  async findAll(): Promise<Tenant[]> {
    const { data, error } = await this.client
      .from('tenants')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(`查询租户列表失败: ${error.message}`);
    return (data || []) as Tenant[];
  }
}

// OAuth 客户端服务
export class OAuthClientService {
  private client = getSupabaseClient();

  async create(data: any): Promise<OAuthClient> {
    const { data: oauthClient, error } = await this.client
      .from('oauth_clients')
      .insert(data)
      .select()
      .single();
    if (error) throw new Error(`创建OAuth客户端失败: ${error.message}`);
    return oauthClient as OAuthClient;
  }

  async findByClientId(clientId: string): Promise<OAuthClient | null> {
    const { data, error } = await this.client
      .from('oauth_clients')
      .select('*')
      .eq('client_id', clientId)
      .maybeSingle();
    if (error) throw new Error(`查询OAuth客户端失败: ${error.message}`);
    return data as OAuthClient | null;
  }

  async findById(id: string): Promise<OAuthClient | null> {
    const { data, error } = await this.client
      .from('oauth_clients')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(`查询OAuth客户端失败: ${error.message}`);
    return data as OAuthClient | null;
  }

  // 获取所有应用（应用是全局共享的，不按租户过滤）
  async findAll(tenantId?: string): Promise<OAuthClient[]> {
    const { data, error } = await this.client
      .from('oauth_clients')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(`查询OAuth客户端列表失败: ${error.message}`);
    return (data || []) as OAuthClient[];
  }

  async verifySecret(client: OAuthClient, secret: string): Promise<boolean> {
    if (!client.client_secret) return false;
    return bcrypt.compare(secret, client.client_secret);
  }

  async deleteByClientId(clientId: string, tenantId?: string): Promise<void> {
    let query = this.client
      .from('oauth_clients')
      .delete()
      .eq('client_id', clientId);
    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }
    const { error } = await query;
    if (error) throw new Error(`删除OAuth客户端失败: ${error.message}`);
  }

  async update(
    clientId: string,
    data: any,
    tenantId?: string,
  ): Promise<OAuthClient> {
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
    const { data: session, error } = await this.client
      .from('user_sessions')
      .insert(data)
      .select()
      .single();
    if (error) throw new Error(`创建会话失败: ${error.message}`);
    return session as UserSession;
  }

  async findByAccessToken(accessToken: string): Promise<UserSession | null> {
    // token 存储在 token_hash 字段中
    const { data, error } = await this.client
      .from('user_sessions')
      .select('*')
      .eq('token_hash', accessToken)
      .maybeSingle();
    if (error) throw new Error(`查询会话失败: ${error.message}`);
    return data as UserSession | null;
  }

  async findByRefreshToken(refreshToken: string): Promise<UserSession | null> {
    // refresh_token 存储在 refresh_token_hash 字段中
    const { data, error } = await this.client
      .from('user_sessions')
      .select('*')
      .eq('refresh_token_hash', refreshToken)
      .maybeSingle();
    if (error) throw new Error(`查询会话失败: ${error.message}`);
    return data as UserSession | null;
  }

  async delete(accessToken: string): Promise<void> {
    const { error } = await this.client
      .from('user_sessions')
      .delete()
      .eq('token_hash', accessToken);
    if (error) throw new Error(`删除会话失败: ${error.message}`);
  }

  async deleteByUserId(userId: string): Promise<void> {
    const { error } = await this.client
      .from('user_sessions')
      .delete()
      .eq('user_id', userId);
    if (error) throw new Error(`删除用户会话失败: ${error.message}`);
  }

  async cleanExpired(): Promise<void> {
    const { error } = await this.client
      .from('user_sessions')
      .delete()
      .lt('expires_at', new Date().toISOString());
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
      query = query
        .gte('created_at', params.startTime)
        .lte('created_at', params.endTime);
    }

    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    query = query
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    const { data, error, count } = await query;
    if (error) throw new Error(`查询审计日志失败: ${error.message}`);
    return { list: (data || []) as AuditLog[], total: count || 0 };
  }
}

// 第三方账户服务
export class ThirdPartyService {
  private client = getSupabaseClient();

  async create(data: any): Promise<ThirdPartyAccount> {
    const { data: account, error } = await this.client
      .from('third_party_accounts')
      .insert(data)
      .select()
      .single();
    if (error) throw new Error(`创建第三方账户失败: ${error.message}`);
    return account as ThirdPartyAccount;
  }

  async findByProvider(
    provider: string,
    providerUserId: string,
  ): Promise<ThirdPartyAccount | null> {
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
    const { data, error } = await this.client
      .from('third_party_accounts')
      .select('*')
      .eq('user_id', userId);
    if (error) throw new Error(`查询用户第三方账户失败: ${error.message}`);
    return (data || []) as ThirdPartyAccount[];
  }

  async delete(userId: string, provider: string): Promise<void> {
    const { error } = await this.client
      .from('third_party_accounts')
      .delete()
      .eq('user_id', userId)
      .eq('provider', provider);
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

// 角色服务（用于获取用户角色）
export class RoleService {
  private client = getSupabaseClient();

  async getUserRoles(
    userId: string,
  ): Promise<{ id: string; name: string; code: string }[]> {
    try {
      // 从 users 表的 metadata 字段获取角色
      const { data, error } = await this.client
        .from('users')
        .select('metadata')
        .eq('id', userId)
        .maybeSingle();

      if (error || !data) {
        console.warn('获取用户角色失败:', error?.message);
        return [];
      }

      // 从 metadata 中提取 roles
      const metadata = (data.metadata || {}) as Record<string, any>;
      const roles = metadata.roles || [];
      return roles.map((r: any) => ({
        id: r.id || r,
        name: r.name || r,
        code: r.code || r,
      }));
    } catch (err) {
      console.warn('获取用户角色异常:', err);
      return [];
    }
  }

  async getUserRoleCodes(userId: string): Promise<string[]> {
    const roles = await this.getUserRoles(userId);
    return roles.map((r) => r.code);
  }

  async assignRoleToUser(userId: string, roleId: string): Promise<void> {
    try {
      const user = await userService.findById(userId);
      if (!user) throw new Error('用户不存在');

      const metadata = (user.metadata || {}) as Record<string, any>;
      const roles = (metadata.roles || []) as any[];

      // 检查是否已存在
      if (roles.some((r: any) => r.id === roleId)) {
        return; // 已存在，跳过
      }

      // 添加新角色
      const { error } = await this.client
        .from('users')
        .update({
          metadata: {
            ...metadata,
            roles: [...roles, roleId],
          },
        })
        .eq('id', userId);

      if (error) throw new Error(`分配角色失败: ${error.message}`);
    } catch (err) {
      console.warn('分配角色失败:', err);
    }
  }
}

// 部门服务（用于获取用户部门信息）
export class DepartmentService {
  private client = getSupabaseClient();

  async findById(id: string): Promise<any | null> {
    const { data, error } = await this.client
      .from('departments')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return null;
    return data;
  }

  async getDepartmentPath(id: string): Promise<string> {
    const path: string[] = [];
    let currentId: string | null = id;

    while (currentId) {
      const { data } = await this.client
        .from('departments')
        .select('id, name, parent_id')
        .eq('id', currentId)
        .single();

      if (data) {
        path.unshift(data.name);
        currentId = data.parent_id;
      } else {
        break;
      }
    }

    return path.join('/');
  }
}

// 导出服务实例
export const userService = new UserService();
export const tenantService = new TenantService();
export const oauthClientService = new OAuthClientService();
export const sessionService = new SessionService();
export const auditService = new AuditService();
export const thirdPartyService = new ThirdPartyService();
export const roleService = new RoleService();
export const departmentService = new DepartmentService();
