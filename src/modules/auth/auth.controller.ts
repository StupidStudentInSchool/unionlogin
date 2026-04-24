import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { authService } from './auth.service';
import { usersService } from '../users/users.service';
import { appsService } from '../apps/apps.service';
import { Public, CurrentUser } from '../../common/decorators/auth.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';

@ApiTags('OAuth 2.0 认证')
@Controller('auth')
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
  ) {
    const authHeader = req.headers.authorization;
    
    if (authHeader) {
      const [type, token] = authHeader.split(' ');
      if (type === 'Bearer' && token) {
        try {
          const introspection = await authService.introspectToken(token);
          if (introspection.active && introspection.sub) {
            const { code, state: newState } = await authService.generateAuthorizationCode(
              clientId,
              redirectUri,
              introspection.sub,
              scope?.split(' ') || ['openid', 'profile', 'email'],
            );

            return {
              requireLogin: false,
              code,
              state: newState,
              redirectUrl: `${redirectUri}?code=${code}&state=${state || newState}`,
            };
          }
        } catch {}
      }
    }

    return {
      requireLogin: true,
      authorizeUrl: `/api/auth/login?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope || '')}&state=${encodeURIComponent(state || '')}`,
    };
  }

  @Public()
  @Post('token')
  @ApiOperation({ summary: '换取 Access Token' })
  @ApiResponse({ status: 200, description: 'Token 响应' })
  async getToken(
    @Body() body: {
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
    await authService.logout(accessToken, userId, ipAddress, req.headers['user-agent']);
    return { success: true };
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'OAuth 登录（简化版）' })
  async oauthLogin(
    @Body() body: { clientId: string; clientSecret: string; username: string; password: string; redirectUri: string },
    @Req() req: Request,
  ) {
    // 验证客户端
    await appsService.validateClient(body.clientId, body.clientSecret, body.redirectUri);

    // 用户登录
    const { user } = await usersService.login(
      { login: body.username, password: body.password },
      (req.headers['x-forwarded-for'] as string) || '',
      req.headers['user-agent'],
    );

    // 生成授权码
    const { code } = await authService.generateAuthorizationCode(
      body.clientId,
      body.redirectUri,
      user.id,
      ['openid', 'profile', 'email'],
    );

    // 换取 Token
    return authService.exchangeCodeForToken(code, body.clientId, body.redirectUri);
  }
}
