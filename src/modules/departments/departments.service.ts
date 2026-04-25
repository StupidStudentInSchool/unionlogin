import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '../../storage/database/supabase-client';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto';

export interface Department {
  id: string;
  tenantId: string;
  parentId: string | null;
  name: string;
  code: string | null;
  level: number;
  sortOrder: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  children?: Department[];
}

@Injectable()
export class DepartmentsService {
  private client = getSupabaseClient();

  /**
   * 获取部门列表（树形结构）
   */
  async findAll(tenantId: string): Promise<Department[]> {
    const { data, error } = await this.client
      .from('departments')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .order('level', { ascending: true })
      .order('sort_order', { ascending: true });

    if (error) throw new Error(`查询部门列表失败: ${error.message}`);

    // 构建树形结构
    return this.buildTree(data || []);
  }

  /**
   * 获取部门详情
   */
  async findOne(id: string, tenantId: string): Promise<Department | null> {
    const { data, error } = await this.client
      .from('departments')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error) return null;
    return data as Department;
  }

  /**
   * 创建部门
   */
  async create(tenantId: string, dto: CreateDepartmentDto): Promise<Department> {
    // 计算层级
    let level = 1;
    if (dto.parentId) {
      const parent = await this.findOne(dto.parentId, tenantId);
      if (parent) {
        level = parent.level + 1;
      }
    }

    const { data, error } = await this.client
      .from('departments')
      .insert({
        tenant_id: tenantId,
        parent_id: dto.parentId || null,
        name: dto.name,
        code: dto.code,
        level,
        sort_order: dto.sortOrder || 0,
        status: 'active',
      })
      .select()
      .single();

    if (error) throw new Error(`创建部门失败: ${error.message}`);
    return data as Department;
  }

  /**
   * 更新部门
   */
  async update(id: string, tenantId: string, dto: UpdateDepartmentDto): Promise<Department> {
    // 如果更改了父部门，需要重新计算层级
    if (dto.parentId) {
      const parent = await this.findOne(dto.parentId, tenantId);
      if (parent) {
        dto.parentId; // 保持更新
      }
    }

    const { data, error } = await this.client
      .from('departments')
      .update({
        ...dto,
        parent_id: dto.parentId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw new Error(`更新部门失败: ${error.message}`);
    return data as Department;
  }

  /**
   * 删除部门
   */
  async remove(id: string, tenantId: string): Promise<void> {
    // 检查是否有子部门
    const { data: children } = await this.client
      .from('departments')
      .select('id')
      .eq('parent_id', id)
      .eq('tenant_id', tenantId);

    if (children && children.length > 0) {
      throw new Error('该部门下存在子部门，无法删除');
    }

    // 检查是否有用户
    const { data: users } = await this.client
      .from('users')
      .select('id')
      .eq('department_id', id)
      .eq('tenant_id', tenantId);

    if (users && users.length > 0) {
      throw new Error('该部门下存在用户，无法删除');
    }

    const { error } = await this.client
      .from('departments')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw new Error(`删除部门失败: ${error.message}`);
  }

  /**
   * 获取用户所属的部门链（用于显示路径）
   */
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

  /**
   * 获取部门树（扁平列表转树）
   */
  private buildTree(list: any[]): Department[] {
    const map = new Map<string, Department>();
    const roots: Department[] = [];

    // 先转成 Map
    list.forEach((item) => {
      map.set(item.id, { ...item, children: [] });
    });

    // 再构建树
    list.forEach((item) => {
      const node = map.get(item.id)!;
      if (item.parent_id && map.has(item.parent_id)) {
        map.get(item.parent_id)!.children!.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  }
}
