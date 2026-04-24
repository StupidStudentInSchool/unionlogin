import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { usersService } from './users.service';
import { Public, CurrentUser } from '../../common/decorators/auth.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';

@ApiTags('用户管理')
@Controller('api/users')
export class UsersController {
  @Public()
  @Post('register')
  @ApiOperation({ summary: '用户注册' })
  async register(
    @Body() body: { username: string; email: string; password: string; nickname?: string },
    @Req() req: Request,
  ) {
    const tenantId = (req.headers['x-tenant-id'] as string) || undefined;
    return usersService.register({ ...body, tenantId });
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: '用户登录' })
  async login(
    @Body() body: { login: string; password: string },
    @Req() req: Request,
  ) {
    const ipAddress = (req.headers['x-forwarded-for'] as string) || '';
    return usersService.login(body, ipAddress, req.headers['user-agent']);
  }

  @UseGuards(AuthGuard)
  @Get('profile')
  @ApiOperation({ summary: '获取当前用户信息' })
  async getProfile(@CurrentUser('userId') userId: string) {
    return usersService.getProfile(userId);
  }

  @UseGuards(AuthGuard)
  @Put('profile')
  @ApiOperation({ summary: '更新用户信息' })
  async updateProfile(
    @CurrentUser('userId') userId: string,
    @Body() body: { nickname?: string; avatar?: string; phone?: string },
  ) {
    return usersService.updateProfile(userId, body);
  }

  @UseGuards(AuthGuard)
  @Put('password')
  @ApiOperation({ summary: '修改密码' })
  async changePassword(
    @CurrentUser('userId') userId: string,
    @Body() body: { oldPassword: string; newPassword: string },
  ) {
    await usersService.changePassword(userId, body.oldPassword, body.newPassword);
    return { success: true };
  }

  @UseGuards(AuthGuard)
  @Get()
  @ApiOperation({ summary: '获取用户列表（管理后台）' })
  async getUsers(
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '20',
    @Req() req: Request,
  ) {
    const tenantId = (req.headers['x-tenant-id'] as string) || undefined;
    return usersService.getUsers(tenantId, parseInt(page), parseInt(pageSize));
  }
}
