import { userService, auditService, thirdPartyService, roleService, departmentService } from '../../storage/database/services';
import { getSupabaseClient } from '../../storage/database/supabase-client';
import type { User, InsertUser } from '../../storage/database/shared/schema';
import * as crypto from 'crypto';

export interface UserWithDetails extends User {
  department?: {
    id: string;
    name: string;
    path?: string;
  } | null;
  roles: string[];
  permissions: string[];
}

export class UsersService {
  // 用户注册
  async register(data: {
    username: string;
    email: string;
    password: string;
    nickname?: string;
    tenantId?: string;
  }): Promise<User> {
    // 检查用户名是否存在
    const existingUser = await userService.findByUsername(data.username);
    if (existingUser) {
      throw new Error('用户名已存在');
    }

    // 检查邮箱是否存在
    const existingEmail = await userService.findByEmail(data.email);
    if (existingEmail) {
      throw new Error('邮箱已被使用');
    }

    // 加密密码
    const passwordHash = await userService.hashPassword(data.password);

    // 创建用户
    const user = await userService.create({
      username: data.username,
      email: data.email,
      password_hash: passwordHash,
      nickname: data.nickname || data.username,
      tenant_id: data.tenantId,
      status: 'active',
    });

    // 记录审计日志
    await auditService.create({
      event_type: 'register',
      user_id: user.id,
      tenant_id: data.tenantId,
    });

    return user;
  }

  // 用户登录
  async login(data: {
    login: string;
    password: string;
  }, ipAddress?: string, userAgent?: string, tenantId?: string): Promise<{ user: User; accessToken?: string; refreshToken?: string }> {
    // 支持用户名或邮箱登录（按租户过滤）
    let user = await userService.findByUsername(data.login, tenantId);
    if (!user) {
      user = await userService.findByEmail(data.login, tenantId);
    }

    if (!user) {
      console.log('[Login] 用户不存在:', data.login);
      throw new Error('用户名或密码错误');
    }

    console.log('[Login] 用户找到:', user.username, 'hasHash:', !!user.password_hash);
    // 验证密码
    const isValid = await userService.verifyPassword(user, data.password);
    console.log('[Login] 密码验证结果:', isValid);
    if (!isValid) {
      throw new Error('用户名或密码错误');
    }

    if (user.status !== 'active') {
      throw new Error('账户已被禁用');
    }

    // 更新登录信息
    await userService.updateLoginInfo(user.id, ipAddress || '');

    // 创建会话并返回 token
    const accessToken = `at_${crypto.randomUUID()}`;
    const refreshToken = `rt_${crypto.randomUUID()}`;
    const expiresAt = new Date(Date.now() + 3600 * 1000); // 1小时后过期

    const client = getSupabaseClient();
    
    // 处理 IP 地址：只取第一个，并截断到 45 字符
    let safeIpAddress = ipAddress || '';
    if (safeIpAddress.includes(',')) {
      safeIpAddress = safeIpAddress.split(',')[0].trim();
    }
    safeIpAddress = safeIpAddress.substring(0, 45);
    
    // 处理 User Agent：截断到合适长度
    const safeUserAgent = (userAgent || '').substring(0, 500);
    
    // 插入 session 并检查是否成功
    const { data: sessionData, error: sessionError } = await client.from('user_sessions').insert({
      user_id: user.id,
      token_hash: accessToken,
      refresh_token_hash: refreshToken,
      ip_address: safeIpAddress,
      user_agent: safeUserAgent,
      expires_at: expiresAt.toISOString(),
    }).select();

    if (sessionError) {
      console.error('[Login] Session 创建失败:', JSON.stringify(sessionError, null, 2));
      console.error('[Login] 尝试插入的数据:', {
        user_id: user.id,
        token_hash_length: accessToken.length,
        ip_address_length: safeIpAddress.length,
        user_agent_length: safeUserAgent.length,
      });
      throw new Error('登录失败：无法创建会话 - ' + sessionError.message);
    }
    
    console.log('[Login] Session 创建成功:', sessionData?.[0]?.id || 'unknown');

    // 获取用户角色和部门信息
    const roles = await roleService.getUserRoleCodes(user.id);
    let department: UserWithDetails['department'] = null;
    if ((user as any).department_id) {
      const dept = await departmentService.findById((user as any).department_id);
      if (dept) {
        const path = await departmentService.getDepartmentPath(dept.id);
        department = {
          id: dept.id,
          name: dept.name,
          path,
        };
      }
    }

    // 获取用户权限
    let permissions: string[] = [];
    try {
      const client = getSupabaseClient();
      const roleIds = (user as any).metadata?.roles || [];
      if (roleIds.length > 0) {
        const { data: roleData } = await client
          .from('roles')
          .select('code, permissions')
          .in('id', roleIds);
        
        if (roleData) {
          const allPermissions = new Set<string>();
          for (const role of roleData) {
            // 管理员角色拥有所有权限
            if (role.code === 'admin') {
              permissions = ['*'];
              break;
            }
            if (role.permissions && Array.isArray(role.permissions)) {
              role.permissions.forEach((p: string) => allPermissions.add(p));
            }
          }
          if (permissions.length === 0) {
            permissions = Array.from(allPermissions);
          }
        }
      }
    } catch (err) {
      console.warn('获取权限失败:', err);
    }

    // 构建完整的用户信息
    const userWithDetails: UserWithDetails = {
      ...user,
      department,
      roles,
      permissions,
    };

    // 记录审计日志
    await auditService.create({
      event_type: 'login',
      user_id: user.id,
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    return { user: userWithDetails, accessToken, refreshToken };
  }

  // 获取用户信息（包含部门、角色）
  async getProfile(userId: string): Promise<UserWithDetails> {
    const user = await userService.findById(userId);
    if (!user) {
      throw new Error('用户不存在');
    }

    // 获取用户角色
    const roles = await roleService.getUserRoleCodes(userId);

    // 获取用户部门
    let department: UserWithDetails['department'] = null;
    if ((user as any).department_id) {
      const dept = await departmentService.findById((user as any).department_id);
      if (dept) {
        const path = await departmentService.getDepartmentPath(dept.id);
        department = {
          id: dept.id,
          name: dept.name,
          path,
        };
      }
    }

    return {
      ...user,
      department,
      roles,
      permissions: [], // 暂时为空，后续可扩展
    };
  }

  // 获取用户完整信息（用于登录返回）
  async getUserWithDetails(userId: string): Promise<UserWithDetails> {
    return this.getProfile(userId);
  }

  // 更新用户信息
  async updateProfile(userId: string, data: { nickname?: string; avatar?: string; phone?: string }): Promise<User> {
    const user = await userService.update(userId, data);
    
    await auditService.create({
      event_type: 'profile_update',
      user_id: userId,
    });

    return user;
  }

  // 修改密码
  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    const user = await userService.findById(userId);
    if (!user) {
      throw new Error('用户不存在');
    }

    // 验证旧密码
    const isValid = await userService.verifyPassword(user, oldPassword);
    if (!isValid) {
      throw new Error('原密码错误');
    }

    // 更新密码
    const passwordHash = await userService.hashPassword(newPassword);
    await userService.update(userId, { password_hash: passwordHash });

    await auditService.create({
      event_type: 'password_change',
      user_id: userId,
    });
  }

  // 第三方登录
  async createOrUpdateThirdPartyUser(
    provider: string,
    providerUserId: string,
    email?: string,
    nickname?: string,
    avatar?: string,
  ): Promise<User> {
    // 查找已绑定的第三方账户
    let thirdPartyAccount = await thirdPartyService.findByProvider(provider, providerUserId);

    if (thirdPartyAccount) {
      // 已存在，返回关联的用户
      const user = await userService.findById(thirdPartyAccount.user_id);
      if (!user) {
        throw new Error('用户不存在');
      }
      return user;
    }

    // 创建新用户
    const passwordHash = await userService.hashPassword(crypto.randomUUID());
    const user = await userService.create({
      username: `${provider}_${providerUserId}`.substring(0, 64),
      email: email || `${provider}_${providerUserId}@placeholder.local`,
      password_hash: passwordHash,
      nickname: nickname,
      avatar: avatar,
      status: 'active',
    });

    // 创建第三方账户关联
    await thirdPartyService.create({
      user_id: user.id,
      provider: provider,
      provider_user_id: providerUserId,
      provider_email: email,
      nickname: nickname,
      avatar: avatar,
    });

    await auditService.create({
      event_type: 'third_party_login',
      user_id: user.id,
    });

    return user;
  }

  // 获取所有用户（管理后台）
  async getUsers(tenantId?: string, page = 1, pageSize = 20): Promise<{ list: any[]; total: number }> {
    const client = getSupabaseClient();
    let query = client.from('users').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
    
    // 只有当 tenantId 有效（不是 'default' 且不是 undefined）时才过滤
    if (tenantId && tenantId !== 'default') {
      query = query.eq('tenant_id', tenantId);
    }

    const { data, error, count } = await query;
    if (error) throw new Error(`查询用户失败: ${error.message}`);
    
    // 获取所有用户的角色 ID 和部门 ID
    const users = (data || []) as any[];
    const allRoleIds: string[] = [];
    const allDeptIds: string[] = [];
    users.forEach(u => {
      const roleIds = u.metadata?.roles || [];
      allRoleIds.push(...roleIds);
      if (u.department_id) {
        allDeptIds.push(u.department_id);
      }
    });
    
    // 查询角色信息
    let roleMap: Record<string, { name: string; code: string }> = {};
    if (allRoleIds.length > 0) {
      const { data: roles } = await client
        .from('roles')
        .select('id, name, code')
        .in('id', [...new Set(allRoleIds)]);
      
      if (roles) {
        roles.forEach(r => {
          roleMap[r.id] = { name: r.name, code: r.code };
        });
      }
    }
    
    // 查询部门信息
    let deptMap: Record<string, string> = {};
    if (allDeptIds.length > 0) {
      const { data: depts } = await client
        .from('departments')
        .select('id, name')
        .in('id', [...new Set(allDeptIds)]);
      
      if (depts) {
        depts.forEach(d => {
          deptMap[d.id] = d.name;
        });
      }
    }
    
    // 组装返回数据，包含角色名称和部门名称
    const usersWithRoles = users.map(u => {
      const roleIds = u.metadata?.roles || [];
      const roles = roleIds.map((id: string) => roleMap[id]).filter(Boolean);
      return {
        ...u,
        roles,
        roleNames: roles.map((r: any) => r.name).join(', '),
        department_name: u.department_id ? deptMap[u.department_id] || null : null,
      };
    });
    
    return { list: usersWithRoles, total: count || 0 };
  }

  // 分配用户部门
  async assignDepartment(userId: string, departmentId: string | null): Promise<void> {
    const user = await userService.findById(userId);
    if (!user) {
      throw new Error('用户不存在');
    }

    // 如果指定了部门，验证部门是否存在
    if (departmentId) {
      const dept = await departmentService.findById(departmentId);
      if (!dept) {
        throw new Error('部门不存在');
      }
    }

    // 更新用户的部门
    await userService.update(userId, { department_id: departmentId } as any);

    await auditService.create({
      event_type: 'department_assign',
      user_id: userId,
      metadata: { department_id: departmentId },
    });
  }
}

export const usersService = new UsersService();
