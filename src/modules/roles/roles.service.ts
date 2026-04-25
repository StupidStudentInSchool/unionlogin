import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '../../storage/database/supabase-client';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';

export interface Role {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  description: string | null;
  level: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class RolesService {
  private client = getSupabaseClient();

  /**
   * 获取角色列表
   */
  async findAll(tenantId: string): Promise<Role[]> {
    const { data, error } = await this.client
      .from('roles')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .order('level', { ascending: false });

    if (error) throw new Error(`查询角色列表失败: ${error.message}`);
    return (data || []) as Role[];
  }

  /**
   * 获取角色详情
   */
  async findOne(id: string, tenantId: string): Promise<Role | null> {
    const { data, error } = await this.client
      .from('roles')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error) return null;
    return data as Role;
  }

  /**
   * 根据编码获取角色
   */
  async findByCode(code: string, tenantId: string): Promise<Role | null> {
    const { data, error } = await this.client
      .from('roles')
      .select('*')
      .eq('code', code)
      .eq('tenant_id', tenantId)
      .single();

    if (error) return null;
    return data as Role;
  }

  /**
   * 创建角色
   */
  async create(tenantId: string, dto: CreateRoleDto): Promise<Role> {
    // 检查编码唯一性
    const existing = await this.findByCode(dto.code, tenantId);
    if (existing) {
      throw new Error(`角色编码 ${dto.code} 已存在`);
    }

    const { data, error } = await this.client
      .from('roles')
      .insert({
        tenant_id: tenantId,
        name: dto.name,
        code: dto.code,
        description: dto.description,
        level: dto.level || 1,
        status: 'active',
      })
      .select()
      .single();

    if (error) throw new Error(`创建角色失败: ${error.message}`);
    return data as Role;
  }

  /**
   * 更新角色
   */
  async update(
    id: string,
    tenantId: string,
    dto: UpdateRoleDto,
  ): Promise<Role> {
    const { data, error } = await this.client
      .from('roles')
      .update({
        ...dto,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw new Error(`更新角色失败: ${error.message}`);
    return data as Role;
  }

  /**
   * 删除角色
   */
  async remove(id: string, tenantId: string): Promise<void> {
    // 检查是否有用户使用该角色
    const { data: userRoles } = await this.client
      .from('user_roles')
      .select('id')
      .eq('role_id', id);

    if (userRoles && userRoles.length > 0) {
      throw new Error('该角色已被用户使用，无法删除');
    }

    const { error } = await this.client
      .from('roles')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw new Error(`删除角色失败: ${error.message}`);
  }

  /**
   * 获取用户的角色列表
   */
  async getUserRoles(userId: string): Promise<Role[]> {
    const { data, error } = await this.client
      .from('user_roles')
      .select(
        `
        role_id,
        roles (*)
      `,
      )
      .eq('user_id', userId);

    if (error) throw new Error(`查询用户角色失败: ${error.message}`);
    return (data || []).map((item: any) => item.roles) as Role[];
  }

  /**
   * 获取用户的角色代码列表
   */
  async getUserRoleCodes(userId: string): Promise<string[]> {
    // 先从用户 metadata.roles 获取角色 ID
    const { data: user } = await this.client
      .from('users')
      .select('metadata')
      .eq('id', userId)
      .single();

    if (!user || !user.metadata?.roles || !Array.isArray(user.metadata.roles)) {
      return [];
    }

    const roleIds = user.metadata.roles as string[];
    if (roleIds.length === 0) {
      return [];
    }

    // 查询角色代码 - 使用 or 条件匹配 UUID
    // Supabase 对 UUID 类型查询需要特殊处理
    const orConditions = roleIds.map((id) => `id.eq.${id}`).join(',');
    const { data: roles } = await this.client
      .from('roles')
      .select('code')
      .or(orConditions);

    return (roles || []).map((r) => r.code);
  }

  /**
   * 分配角色给用户
   */
  async assignRoles(userId: string, roleIds: string[]): Promise<void> {
    // 先删除旧的角色
    await this.client.from('user_roles').delete().eq('user_id', userId);

    // 添加新的角色
    if (roleIds.length > 0) {
      const inserts = roleIds.map((roleId) => ({
        user_id: userId,
        role_id: roleId,
      }));

      const { error } = await this.client.from('user_roles').insert(inserts);

      if (error) throw new Error(`分配角色失败: ${error.message}`);
    }
  }

  /**
   * 批量获取用户角色（根据角色ID列表）
   */
  async getRolesByIds(roleIds: string[]): Promise<Role[]> {
    if (roleIds.length === 0) return [];

    const { data, error } = await this.client
      .from('roles')
      .select('*')
      .in('id', roleIds);

    if (error) throw new Error(`查询角色列表失败: ${error.message}`);
    return (data || []) as Role[];
  }
}
