import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { transactionService } from '../../storage/database/transaction.service';
import { auditService } from '../../storage/database/services';
import { Public } from '../../common/decorators/auth.decorator';

@ApiTags('初始化')
@Controller('api/init')
export class InitController {
  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '初始化系统（创建租户、管理员和默认应用）' })
  async initialize(@Body() body: {
    tenantName: string;
    tenantSlug: string;
    username: string;
    email: string;
    password: string;
  }) {
    // 验证输入
    if (!body.tenantName || !body.tenantSlug || !body.username || !body.email || !body.password) {
      return { success: false, message: '请填写所有必填字段' };
    }

    if (body.password.length < 8) {
      return { success: false, message: '密码至少8个字符' };
    }

    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(body.email)) {
      return { success: false, message: '请输入有效的邮箱地址' };
    }

    if (!/^[a-z0-9-]+$/.test(body.tenantSlug)) {
      return { success: false, message: '租户标识只能包含小写字母、数字和短横线' };
    }

    try {
      // 执行带事务的初始化（包含创建 session）
      const result = await transactionService.initializeTenant({
        tenant: { name: body.tenantName, slug: body.tenantSlug },
        admin: { username: body.username, email: body.email, password: body.password },
      });

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
        app: result.app ? {
          id: result.app.id,
          name: result.app.name,
          clientId: result.app.client_id,
          clientSecret: result.clientSecret,
        } : null,
        token: {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        },
      };
    } catch (error: any) {
      console.error('初始化失败:', error);
      throw new Error(error.message || '初始化失败，请稍后重试');
    }
  }
}
