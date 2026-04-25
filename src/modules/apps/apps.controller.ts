import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { appsService } from './apps.service';
import { Public, CurrentUser } from '../../common/decorators/auth.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';

@ApiTags('应用管理')
@Controller('api/apps')
export class AppsController {
  @UseGuards(AuthGuard)
  @Post()
  @ApiOperation({ summary: '创建应用' })
  async createApp(
    @Body() body: { name: string; redirectUris: string[]; scopes?: string[] },
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId || (req.headers['x-tenant-id'] as string);
    const result = await appsService.createApp({ ...body, tenantId });
    
    return {
      app: {
        id: result.app.id,
        name: result.app.name,
        client_id: result.app.client_id,
        redirect_uris: result.app.redirect_uris,
        scopes: result.app.scopes,
        status: result.app.status,
        created_at: result.app.created_at,
        tenant_id: result.app.tenant_id,
      },
      clientSecret: result.clientSecret,
    };
  }

  @Get()
  @ApiOperation({ summary: '获取应用列表' })
  async getApps(@Req() req: Request) {
    const tenantId = (req as any).tenantId;
    return appsService.getApps(tenantId);
  }

  @Public()
  @Get(':clientId')
  @ApiOperation({ summary: '获取应用详情' })
  async getApp(@Param('clientId') clientId: string) {
    return appsService.getApp(clientId);
  }

  @Put(':clientId')
  @ApiOperation({ summary: '更新应用' })
  async updateApp(
    @Param('clientId') clientId: string,
    @Body() body: { name?: string; redirectUris?: string[]; scopes?: string[] },
    @Req() req: Request,
  ) {
    const tenantId = (req.headers['x-tenant-id'] as string) || (req as any).tenantId;
    const result = await appsService.updateApp(clientId, body, tenantId);
    return { success: true, data: result };
  }

  @Delete(':clientId')
  @ApiOperation({ summary: '删除应用' })
  async deleteApp(@Param('clientId') clientId: string, @Req() req: Request) {
    const tenantId = (req.headers['x-tenant-id'] as string) || (req as any).tenantId;
    await appsService.deleteApp(clientId, tenantId);
    return { success: true, message: '删除成功' };
  }

  @UseGuards(AuthGuard)
  @Get(':clientId/secret')
  @ApiOperation({ summary: '获取应用密钥' })
  async getAppSecret(@Param('clientId') clientId: string) {
    const result = await appsService.getAppForAdmin(clientId);
    return {
      app: {
        id: result.app.id,
        name: result.app.name,
        client_id: result.app.client_id,
      },
      clientSecret: result.clientSecret,
    };
  }
}
