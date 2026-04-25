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
import { RolesService } from './roles.service';
import { CreateRoleDto, UpdateRoleDto, AssignRolesDto } from './dto/role.dto';
import { AuthGuard } from '../../common/guards/auth.guard';

@Controller('api/roles')
@UseGuards(AuthGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  async findAll(@Query('tenantId') tenantId: string) {
    const list = await this.rolesService.findAll(tenantId);
    return { success: true, data: list };
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Query('tenantId') tenantId: string) {
    const role = await this.rolesService.findOne(id, tenantId);
    if (!role) {
      return { success: false, error: '角色不存在' };
    }
    return { success: true, data: role };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateRoleDto,
    @Query('tenantId') tenantId: string,
  ) {
    const role = await this.rolesService.create(tenantId, dto);
    return { success: true, data: role };
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @Query('tenantId') tenantId: string,
  ) {
    const role = await this.rolesService.update(id, tenantId, dto);
    return { success: true, data: role };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string, @Query('tenantId') tenantId: string) {
    await this.rolesService.remove(id, tenantId);
    return { success: true, message: '删除成功' };
  }

  @Get('user/:userId')
  async getUserRoles(@Param('userId') userId: string) {
    const roles = await this.rolesService.getUserRoles(userId);
    return { success: true, data: roles };
  }

  @Post('assign')
  @HttpCode(HttpStatus.OK)
  async assignRoles(@Body() dto: AssignRolesDto) {
    await this.rolesService.assignRoles(dto.userId, dto.roleIds);
    return { success: true, message: '角色分配成功' };
  }
}
