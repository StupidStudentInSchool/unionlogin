import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AppsService } from './apps.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantId, ApiTenantQuery } from '../../common/decorators/auth.decorator';
import { CreateAppDto, UpdateAppDto, AppResponseDto, AppWithSecretDto } from './dto/app.dto';

@ApiTags('应用管理')
@Controller('apps')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class AppsController {
  constructor(private readonly appsService: AppsService) {}

  @Post()
  @ApiOperation({ summary: '创建应用' })
  @ApiTenantQuery()
  @ApiResponse({ status: 201, description: '创建成功', type: AppWithSecretDto })
  async create(@Body() dto: CreateAppDto, @TenantId() tenantId?: string) {
    return this.appsService.create(dto, tenantId);
  }

  @Get()
  @ApiOperation({ summary: '获取应用列表' })
  @ApiTenantQuery()
  @ApiResponse({ status: 200, description: '应用列表', type: [AppResponseDto] })
  async findAll(@TenantId() tenantId?: string) {
    return this.appsService.findAll(tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取应用详情' })
  @ApiResponse({ status: 200, description: '应用详情', type: AppResponseDto })
  async findOne(@Param('id') id: string) {
    return this.appsService.findById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: '更新应用' })
  @ApiResponse({ status: 200, description: '更新成功', type: AppResponseDto })
  async update(@Param('id') id: string, @Body() dto: UpdateAppDto) {
    return this.appsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除应用' })
  @ApiResponse({ status: 200, description: '删除成功' })
  async remove(@Param('id') id: string) {
    await this.appsService.delete(id);
    return { message: '应用已删除' };
  }
}
