import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import type { Request } from 'express';
import { UsersService } from './users.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { Public, CurrentUser } from '../../common/decorators/auth.decorator';
import { 
  RegisterDto, 
  LoginDto, 
  UpdateProfileDto, 
  ChangePasswordDto,
  UserResponseDto,
  TokenResponseDto 
} from './dto/user.dto';

@ApiTags('用户管理')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Public()
  @Post('register')
  @HttpCode(201)
  @ApiOperation({ summary: '用户注册' })
  @ApiResponse({ status: 201, description: '注册成功', type: UserResponseDto })
  @ApiResponse({ status: 409, description: '用户名或邮箱已存在' })
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    const ipAddress = req.headers['x-forwarded-for'] as string || '';
    const userAgent = req.headers['user-agent'] || '';
    return this.usersService.register(dto, ipAddress, userAgent);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: '用户登录' })
  @ApiResponse({ status: 200, description: '登录成功', type: TokenResponseDto })
  @ApiResponse({ status: 401, description: '用户名或密码错误' })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const ipAddress = req.headers['x-forwarded-for'] as string || '';
    const userAgent = req.headers['user-agent'] || '';
    return this.usersService.login(dto, ipAddress, userAgent);
  }

  @UseGuards(AuthGuard)
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取当前用户信息' })
  @ApiResponse({ status: 200, description: '用户信息', type: UserResponseDto })
  async getProfile(@CurrentUser('userId') userId: string) {
    return this.usersService.getProfile(userId);
  }

  @UseGuards(AuthGuard)
  @Put('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新个人信息' })
  @ApiResponse({ status: 200, description: '更新成功', type: UserResponseDto })
  async updateProfile(
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateProfileDto,
    @Req() req: Request,
  ) {
    const ipAddress = req.headers['x-forwarded-for'] as string || '';
    const userAgent = req.headers['user-agent'] || '';
    return this.usersService.updateProfile(userId, dto, ipAddress, userAgent);
  }

  @UseGuards(AuthGuard)
  @Put('password')
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOperation({ summary: '修改密码' })
  @ApiResponse({ status: 200, description: '密码修改成功' })
  async changePassword(
    @CurrentUser('userId') userId: string,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ) {
    const ipAddress = req.headers['x-forwarded-for'] as string || '';
    const userAgent = req.headers['user-agent'] || '';
    await this.usersService.changePassword(userId, dto, ipAddress, userAgent);
    return { message: '密码修改成功' };
  }

  @UseGuards(AuthGuard)
  @Get('sessions')
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取登录设备列表' })
  @ApiResponse({ status: 200, description: '设备列表' })
  async getSessions(@CurrentUser('userId') userId: string) {
    return this.usersService.getUserSessions(userId);
  }

  @UseGuards(AuthGuard)
  @Delete('sessions/:sessionId')
  @ApiBearerAuth()
  @ApiOperation({ summary: '强制登出某设备' })
  @ApiResponse({ status: 200, description: '登出成功' })
  async revokeSession(
    @CurrentUser('userId') userId: string,
    @Param('sessionId') sessionId: string,
    @Req() req: Request,
  ) {
    const ipAddress = req.headers['x-forwarded-for'] as string || '';
    const userAgent = req.headers['user-agent'] || '';
    await this.usersService.revokeSession(userId, sessionId, ipAddress, userAgent);
    return { message: '设备已登出' };
  }
}
