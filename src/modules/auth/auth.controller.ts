import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Req,
  Res,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { authService } from './auth.service';
import { usersService } from '../users/users.service';
import { appsService } from '../apps/apps.service';
import { Public, CurrentUser } from '../../common/decorators/auth.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';

@ApiTags('OAuth 2.0 认证')
@Controller('api/auth')
export class AuthController {
  @Public()
  @Get('authorize')
  @ApiOperation({ summary: 'OAuth 授权入口' })
  async authorize(
    @Query('client_id') clientId: string,
    @Query('redirect_uri') redirectUri: string,
    @Query('response_type') responseType: string,
    @Query('scope') scope: string,
    @Query('state') state: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    // 验证必填参数
    if (!clientId || !redirectUri) {
      throw new HttpException(
        '缺少必要参数: client_id, redirect_uri',
        HttpStatus.BAD_REQUEST,
      );
    }

    // 验证应用是否存在及 redirect_uri 是否合法
    const client = await appsService.findByClientId(clientId);
    if (!client) {
      throw new HttpException('无效的 client_id', HttpStatus.BAD_REQUEST);
    }

    // 验证 redirect_uri 是否在应用的回调地址列表中
    const redirectUris = client.redirect_uris || [];
    if (!redirectUris.includes(redirectUri)) {
      throw new HttpException(
        'redirect_uri 不匹配',
        HttpStatus.BAD_REQUEST,
      );
    }

    // 检查用户是否已登录（从 cookie 或 Authorization header 读取 token）
    let userId: string | null = null;
    let accessToken: string | null = null;

    // 1. 优先从 cookie 读取 access_token
    const cookies = req.cookies as Record<string, string> | undefined;
    if (cookies?.access_token) {
      accessToken = cookies.access_token;
    }

    // 2. 其次从 Authorization header 读取
    if (!accessToken) {
      const authHeader = req.headers.authorization;
      if (authHeader) {
        const [type, token] = authHeader.split(' ');
        if (type === 'Bearer' && token) {
          accessToken = token;
        }
      }
    }

    // 3. 验证 token 获取用户信息
    if (accessToken) {
      try {
        const introspection = await authService.introspectToken(accessToken);
        if (introspection.active && introspection.sub) {
          userId = introspection.sub;
        }
      } catch {
        // Token 无效，清除无效的 cookie
        res.clearCookie('access_token');
      }
    }

    // 用户未登录：重定向到登录页面
    if (!userId) {
      const loginUrl = `/login.html?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=${encodeURIComponent(responseType || 'code')}&scope=${encodeURIComponent(scope || 'openid profile email')}&state=${encodeURIComponent(state || '')}`;
      return res.redirect(loginUrl);
    }

    // 用户已登录：检查是否有权限访问该应用
    const hasPermission = await usersService.hasAppPermission(userId, client.id);
    if (!hasPermission) {
      // 无权限：重定向回 redirect_uri 并附带错误信息
      const errorUrl = `${redirectUri}?error=access_denied&error_description=${encodeURIComponent('您没有被授权访问此应用')}&state=${encodeURIComponent(state || '')}`;
      return res.redirect(errorUrl);
    }

    // 用户有权限：生成授权码并重定向
    const { code, state: newState } = await authService.generateAuthorizationCode(
      clientId,
      redirectUri,
      userId,
      scope?.split(' ') || ['openid', 'profile', 'email'],
    );

    // 重定向回应用的 redirect_uri
    const callbackUrl = `${redirectUri}?code=${code}&state=${encodeURIComponent(state || newState || '')}`;
    return res.redirect(callbackUrl);
  }

  @Public()
  @Post('token')
  @ApiOperation({ summary: '换取 Access Token' })
  @ApiResponse({ status: 200, description: 'Token 响应' })
  async getToken(
    @Body()
    body: {
      grant_type: string;
      client_id?: string;
      client_secret?: string;
      code?: string;
      redirect_uri?: string;
      refresh_token?: string;
    },
    @Req() req: Request,
  ) {
    if (body.grant_type === 'authorization_code') {
      return authService.exchangeCodeForToken(
        body.code!,
        body.client_id!,
        body.redirect_uri!,
      );
    } else if (body.grant_type === 'refresh_token') {
      return authService.refreshAccessToken(body.refresh_token!);
    }
    throw new Error('不支持的 grant_type');
  }

  @UseGuards(AuthGuard)
  @Get('userinfo')
  @ApiOperation({ summary: '获取用户信息' })
  async getUserInfo(@CurrentUser('accessToken') accessToken: string) {
    return authService.getUserInfo(accessToken);
  }

  @Public()
  @Post('introspect')
  @ApiOperation({ summary: '验证 Token 有效性' })
  async introspect(@Body() body: { token: string }) {
    return authService.introspectToken(body.token);
  }

  @Public()
  @Post('revoke')
  @ApiOperation({ summary: '撤销 Token' })
  async revoke(@Body() body: { token: string }) {
    await authService.revokeToken(body.token);
    return { success: true };
  }

  @UseGuards(AuthGuard)
  @Post('logout')
  @ApiOperation({ summary: '单点登出' })
  async logout(
    @CurrentUser('accessToken') accessToken: string,
    @CurrentUser('userId') userId: string,
    @Req() req: Request,
  ) {
    const ipAddress = (req.headers['x-forwarded-for'] as string) || '';
    await authService.logout(
      accessToken,
      userId,
      ipAddress,
      req.headers['user-agent'],
    );
    return { success: true };
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'OAuth 登录（简化版）' })
  async oauthLogin(
    @Body()
    body: {
      clientId: string;
      clientSecret: string;
      username: string;
      password: string;
      redirectUri: string;
    },
    @Req() req: Request,
  ) {
    // 验证客户端
    const client = await appsService.validateClient(
      body.clientId,
      body.clientSecret,
      body.redirectUri,
    );

    // 用户登录
    const { user } = await usersService.login(
      { login: body.username, password: body.password },
      (req.headers['x-forwarded-for'] as string) || '',
      req.headers['user-agent'],
    );

    // 检查用户是否有权限访问该应用
    const hasPermission = await usersService.hasAppPermission(
      user.id,
      client.id,
    );
    if (!hasPermission) {
      throw new Error('您没有被授权访问此应用');
    }

    // 生成授权码
    const { code } = await authService.generateAuthorizationCode(
      body.clientId,
      body.redirectUri,
      user.id,
      ['openid', 'profile', 'email'],
    );

    // 换取 Token
    return authService.exchangeCodeForToken(
      code,
      body.clientId,
      body.redirectUri,
    );
  }
}
