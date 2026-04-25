import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto';
import { AuthGuard } from '../../common/guards/auth.guard';

@Controller('api/departments')
@UseGuards(AuthGuard)
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  async findAll(@Query('tenantId') tenantId: string) {
    const list = await this.departmentsService.findAll(tenantId);
    return { success: true, data: list };
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Query('tenantId') tenantId: string) {
    const department = await this.departmentsService.findOne(id, tenantId);
    if (!department) {
      return { success: false, error: '部门不存在' };
    }

    // 获取部门路径
    const path = await this.departmentsService.getDepartmentPath(id);

    return {
      success: true,
      data: { ...department, path },
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateDepartmentDto,
    @Query('tenantId') tenantId: string,
  ) {
    const department = await this.departmentsService.create(tenantId, dto);
    return { success: true, data: department };
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
    @Query('tenantId') tenantId: string,
  ) {
    const department = await this.departmentsService.update(id, tenantId, dto);
    return { success: true, data: department };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string, @Query('tenantId') tenantId: string) {
    await this.departmentsService.remove(id, tenantId);
    return { success: true, message: '删除成功' };
  }
}
