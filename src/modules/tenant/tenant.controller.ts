import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { TenantService } from './tenant.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CreateTenantDto, UpdateTenantDto, TenantResponseDto } from './dto/tenant.dto';

@ApiTags('租户管理')
@Controller('tenants')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Post()
  @ApiOperation({ summary: '创建租户' })
  @ApiResponse({ status: 201, description: '创建成功', type: TenantResponseDto })
  async create(@Body() dto: CreateTenantDto) {
    return this.tenantService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: '获取租户列表' })
  @ApiResponse({ status: 200, description: '租户列表', type: [TenantResponseDto] })
  async findAll() {
    return this.tenantService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: '获取租户详情' })
  @ApiResponse({ status: 200, description: '租户详情', type: TenantResponseDto })
  async findOne(@Param('id') id: string) {
    return this.tenantService.findById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: '更新租户' })
  @ApiResponse({ status: 200, description: '更新成功', type: TenantResponseDto })
  async update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.tenantService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除租户' })
  @ApiResponse({ status: 200, description: '删除成功' })
  async remove(@Param('id') id: string) {
    await this.tenantService.delete(id);
    return { message: '租户已删除' };
  }
}
