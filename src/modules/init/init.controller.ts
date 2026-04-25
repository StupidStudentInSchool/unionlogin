import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { transactionService } from '../../storage/database/transaction.service';
import {
  auditService,
  getSupabaseClient,
} from '../../storage/database/services';
import { Public } from '../../common/decorators/auth.decorator';

@ApiTags('初始化')
@Controller('api/init')
export class InitController {
  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '初始化系统（创建租户、管理员、默认应用和角色）' })
  async initialize(
    @Body()
    body: {
      tenantName: string;
      tenantSlug: string;
      username: string;
      email: string;
      password: string;
    },
  ) {
    // 验证输入
    if (
      !body.tenantName ||
      !body.tenantSlug ||
      !body.username ||
      !body.email ||
      !body.password
    ) {
      return { success: false, message: '请填写所有必填字段' };
    }

    if (body.password.length < 8) {
      return { success: false, message: '密码至少8个字符' };
    }

    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(body.email)) {
      return { success: false, message: '请输入有效的邮箱地址' };
    }

    if (!/^[a-z0-9-]+$/.test(body.tenantSlug)) {
      return {
        success: false,
        message: '租户标识只能包含小写字母、数字和短横线',
      };
    }

    const client = getSupabaseClient();

    try {
      // 执行带事务的初始化（包含创建 session）
      const result = await transactionService.initializeTenant({
        tenant: { name: body.tenantName, slug: body.tenantSlug },
        admin: {
          username: body.username,
          email: body.email,
          password: body.password,
        },
      });

      // 创建默认角色和部门
      const defaultRoles: any[] = [];
      const defaultDepts: any[] = [];
      const defaultRole = {
        id: null as string | null,
        name: null as string | null,
        code: null as string | null,
      };
      const defaultDept = {
        id: null as string | null,
        name: null as string | null,
        code: null as string | null,
      };

      // 系统权限定义
      const ALL_PERMISSIONS = [
        'user:read',
        'user:write',
        'user:delete',
        'role:read',
        'role:write',
        'role:delete',
        'department:read',
        'department:write',
        'department:delete',
        'app:read',
        'app:write',
        'app:delete',
        'tenant:read',
        'tenant:write',
        'audit:read',
        'settings:read',
        'settings:write',
        '*',
      ];

      // 普通用户权限：只读
      const USER_PERMISSIONS = [
        'user:read',
        'role:read',
        'department:read',
        'app:read',
      ];

      // 部门经理权限：读写部门 + 只读其他
      const MANAGER_PERMISSIONS = [
        'user:read',
        'user:write',
        'role:read',
        'department:read',
        'department:write',
        'app:read',
        'audit:read',
      ];

      try {
        // 创建管理员角色（拥有所有权限）
        const { data: adminRole, error: roleError } = await client
          .from('roles')
          .insert({
            tenant_id: result.tenant.id,
            name: '管理员',
            code: 'admin',
            level: 100,
            description: '系统管理员角色，拥有所有权限',
            is_system: true,
            status: 'active',
            permissions: ALL_PERMISSIONS,
          })
          .select()
          .single();

        if (!roleError && adminRole) {
          console.log('✅ 默认管理员角色创建成功:', adminRole.id);
          defaultRole.id = adminRole.id;
          defaultRole.name = adminRole.name;
          defaultRole.code = adminRole.code;
          defaultRoles.push(adminRole);
        }

        // 创建普通用户角色
        const { data: userRole, error: userRoleError } = await client
          .from('roles')
          .insert({
            tenant_id: result.tenant.id,
            name: '普通用户',
            code: 'user',
            level: 1,
            description: '普通用户角色，只读权限',
            is_system: true,
            status: 'active',
            permissions: USER_PERMISSIONS,
          })
          .select()
          .single();

        if (!userRoleError && userRole) {
          console.log('✅ 默认普通用户角色创建成功:', userRole.id);
          defaultRoles.push(userRole);
        }

        // 创建部门经理角色
        const { data: managerRole, error: managerRoleError } = await client
          .from('roles')
          .insert({
            tenant_id: result.tenant.id,
            name: '部门经理',
            code: 'manager',
            level: 50,
            description: '部门经理角色，可管理部门',
            is_system: true,
            status: 'active',
            permissions: MANAGER_PERMISSIONS,
          })
          .select()
          .single();

        if (!managerRoleError && managerRole) {
          console.log('✅ 部门经理角色创建成功:', managerRole.id);
          defaultRoles.push(managerRole);
        }

        // 创建总公司
        const { data: rootDept, error: rootDeptError } = await client
          .from('departments')
          .insert({
            tenant_id: result.tenant.id,
            name: body.tenantName, // 使用租户名称作为总公司名称
            code: 'hq',
            level: 0,
            sort_order: 0,
            description: `${body.tenantName}总部`,
            status: 'active',
          })
          .select()
          .single();

        if (!rootDeptError && rootDept) {
          console.log('✅ 总部创建成功:', rootDept.id);
          defaultDept.id = rootDept.id;
          defaultDept.name = rootDept.name;
          defaultDept.code = rootDept.code;
          defaultDepts.push(rootDept);
        }

        // 创建总经办
        const { data: ceoDept, error: ceoDeptError } = await client
          .from('departments')
          .insert({
            tenant_id: result.tenant.id,
            name: '总经办',
            code: 'ceo_office',
            parent_id: rootDept?.id || null,
            level: 1,
            sort_order: 1,
            description: '总经理办公室',
            status: 'active',
          })
          .select()
          .single();

        if (!ceoDeptError && ceoDept) {
          console.log('✅ 总经办创建成功:', ceoDept.id);
          defaultDepts.push(ceoDept);
        }

        // 创建技术部
        const { data: techDept, error: techDeptError } = await client
          .from('departments')
          .insert({
            tenant_id: result.tenant.id,
            name: '技术部',
            code: 'tech',
            parent_id: rootDept?.id || null,
            level: 1,
            sort_order: 10,
            description: '技术研发部门',
            status: 'active',
          })
          .select()
          .single();

        if (!techDeptError && techDept) {
          console.log('✅ 技术部创建成功:', techDept.id);
          defaultDepts.push(techDept);
        }

        // 创建人力资源部
        const { data: hrDept, error: hrDeptError } = await client
          .from('departments')
          .insert({
            tenant_id: result.tenant.id,
            name: '人力资源部',
            code: 'hr',
            parent_id: rootDept?.id || null,
            level: 1,
            sort_order: 20,
            description: '人力资源部门',
            status: 'active',
          })
          .select()
          .single();

        if (!hrDeptError && hrDept) {
          console.log('✅ 人力资源部创建成功:', hrDept.id);
          defaultDepts.push(hrDept);
        }

        // 创建财务部
        const { data: financeDept, error: financeDeptError } = await client
          .from('departments')
          .insert({
            tenant_id: result.tenant.id,
            name: '财务部',
            code: 'finance',
            parent_id: rootDept?.id || null,
            level: 1,
            sort_order: 30,
            description: '财务管理部门',
            status: 'active',
          })
          .select()
          .single();

        if (!financeDeptError && financeDept) {
          console.log('✅ 财务部创建成功:', financeDept.id);
          defaultDepts.push(financeDept);
        }

        // 给管理员分配 admin 角色
        if (adminRole) {
          await client
            .from('users')
            .update({
              metadata: {
                roles: [adminRole.id],
              },
            })
            .eq('id', result.user.id);
          console.log('✅ 管理员角色分配成功');
        }

        // 给用户分配总经办
        if (ceoDept) {
          await client
            .from('users')
            .update({
              department_id: ceoDept.id,
            })
            .eq('id', result.user.id);
          console.log('✅ 用户部门分配成功');
        }
      } catch (initError) {
        console.warn('初始化默认数据失败（不影响主流程）:', initError);
      }

      // 记录审计日志（可选，失败不影响主流程）
      try {
        await auditService.create({
          event_type: 'tenant_initialized',
          user_id: result.user.id,
          tenant_id: result.tenant.id,
          ip_address: '0.0.0.0',
          user_agent: 'System',
        });
      } catch (auditError) {
        console.warn('审计日志记录失败（不影响主流程）:', auditError);
      }

      // 返回结果，使用数据库 session 的 token
      return {
        success: true,
        message: '初始化成功',
        tenant: {
          id: result.tenant.id,
          name: result.tenant.name,
          slug: result.tenant.slug,
        },
        user: {
          id: result.user.id,
          username: result.user.username,
          email: result.user.email,
        },
        app: result.app
          ? {
              id: result.app.id,
              name: result.app.name,
              clientId: result.app.client_id,
              clientSecret: result.clientSecret,
            }
          : null,
        token: {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        },
        defaults: {
          roles: defaultRoles,
          departments: defaultDepts,
        },
      };
    } catch (error: any) {
      console.error('初始化失败:', error);
      throw new Error(error.message || '初始化失败，请稍后重试');
    }
  }
}
