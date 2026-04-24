import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { tenantService } from './tenant.module';
import { Public } from '../../common/decorators/auth.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';

@ApiTags('租户管理')
@Controller('tenants')
export class TenantController {
  @Public()
  @Post()
  @ApiOperation({ summary: '创建租户' })
  async createTenant(@Body() body: { name: string; slug: string }) {
    return tenantService.create(body);
  }

  @UseGuards(AuthGuard)
  @Get()
  @ApiOperation({ summary: '获取租户列表' })
  async getTenants() {
    return tenantService.findAll();
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: '获取租户详情' })
  async getTenant(@Param('id') id: string) {
    return tenantService.findById(id);
  }
}
