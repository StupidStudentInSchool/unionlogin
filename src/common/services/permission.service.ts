import { getSupabaseClient } from '../../storage/database/supabase-client';

/**
 * 系统权限定义
 */
export const SYSTEM_PERMISSIONS = {
  USER_READ: 'user:read',
  USER_WRITE: 'user:write',
  USER_DELETE: 'user:delete',
  ROLE_READ: 'role:read',
  ROLE_WRITE: 'role:write',
  ROLE_DELETE: 'role:delete',
  DEPARTMENT_READ: 'department:read',
  DEPARTMENT_WRITE: 'department:write',
  DEPARTMENT_DELETE: 'department:delete',
  APP_READ: 'app:read',
  APP_WRITE: 'app:write',
  APP_DELETE: 'app:delete',
  TENANT_READ: 'tenant:read',
  TENANT_WRITE: 'tenant:write',
  AUDIT_READ: 'audit:read',
  SETTINGS_READ: 'settings:read',
  SETTINGS_WRITE: 'settings:write',
  ALL: '*',
} as const;

export type Permission = typeof SYSTEM_PERMISSIONS[keyof typeof SYSTEM_PERMISSIONS];

export class PermissionService {
  private client = getSupabaseClient();

  async getUserPermissions(userId: string): Promise<string[]> {
    const user = await this.client.from('users').select('metadata').eq('id', userId).single();
    if (!user.data?.metadata?.roles) return [];

    const roleIds = user.data.metadata.roles as string[];
    if (!roleIds.length) return [];

    const { data: roles } = await this.client.from('roles').select('code, permissions').in('id', roleIds);
    if (!roles) return [];

    const allPermissions = new Set<string>();
    for (const role of roles) {
      if (role.code === 'admin') return ['*'];
      if (role.permissions && Array.isArray(role.permissions)) {
        role.permissions.forEach((p: string) => allPermissions.add(p));
      }
    }
    return Array.from(allPermissions);
  }

  async hasPermission(userId: string, permission: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    if (permissions.includes('*')) return true;
    if (permissions.includes(permission)) return true;
    const [resource] = permission.split(':');
    if (permissions.includes(`${resource}:*`)) return true;
    return false;
  }

  async isAdmin(userId: string): Promise<boolean> {
    const user = await this.client.from('users').select('metadata').eq('id', userId).single();
    if (!user.data?.metadata?.roles) return false;
    const roleIds = user.data.metadata.roles as string[];
    const { data: roles } = await this.client.from('roles').select('code').in('id', roleIds);
    return roles?.some(r => r.code === 'admin') ?? false;
  }
}

export const permissionService = new PermissionService();
