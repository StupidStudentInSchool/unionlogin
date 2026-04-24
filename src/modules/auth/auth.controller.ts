import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { Public, CurrentUser } from '../../common/decorators/auth.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import {
  AuthorizeDto,
  TokenRequestDto,
  TokenResponseDto,
  UserInfoResponseDto,
  IntrospectRequestDto,
  IntrospectResponseDto,
  RevokeRequestDto,
} from './dto/oauth.dto';

@ApiTags('OAuth 2.0 认证')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Get('authorize')
  @ApiOperation({ summary: 'OAuth 授权页面' })
  async authorize(@Body() dto: AuthorizeDto, @Req() req: Request) {
    const authHeader = req.headers.authorization;
    
    if (authHeader) {
      const [type, token] = authHeader.split(' ');
      if (type === 'Bearer' && token) {
        try {
          const userId = await this.verifyToken(token);
          const { code, state } = await this.authService.generateAuthorizationCode(
            dto,
            userId,
            this.getIpAddress(req),
            req.headers['user-agent'],
          );
          
          const redirectUrl = new URL(dto.redirectUri);
          redirectUrl.searchParams.set('code', code);
          if (state) redirectUrl.searchParams.set('state', state);
          
          return { redirectUrl: redirectUrl.toString() };
        } catch {
          // Token 无效，继续要求登录
        }
      }
    }

    return {
      requireLogin: true,
      authorizeUrl: `/api/auth/authorize?clientId=${dto.clientId}&redirectUri=${dto.redirectUri}&responseType=${dto.responseType}&scope=${(dto.scope || []).join(' ')}&state=${dto.state || ''}`,
    };
  }

  @Public()
  @Post('authorize')
  @ApiOperation({ summary: '直接授权（已登录用户）' })
  @ApiResponse({ status: 200, description: '授权成功' })
  async authorizeDirect(
    @Body() dto: AuthorizeDto,
    @CurrentUser('userId') userId: string,
    @Req() req: Request,
  ) {
    const { code, state } = await this.authService.generateAuthorizationCode(
      dto,
      userId,
      this.getIpAddress(req),
      req.headers['user-agent'],
    );

    const redirectUrl = new URL(dto.redirectUri);
    redirectUrl.searchParams.set('code', code);
    if (state) redirectUrl.searchParams.set('state', state);

    return { redirectUrl: redirectUrl.toString() };
  }

  @Public()
  @Post('token')
  @ApiOperation({ summary: '换取 Access Token' })
  @ApiResponse({ status: 200, description: 'Token 响应', type: TokenResponseDto })
  async getToken(@Body() dto: TokenRequestDto, @Req() req: Request) {
    if (dto.grantType === 'authorization_code') {
      return this.authService.exchangeCodeForToken(dto, this.getIpAddress(req), req.headers['user-agent']);
    } else if (dto.grantType === 'refresh_token') {
      return this.authService.refreshAccessToken(dto, this.getIpAddress(req), req.headers['user-agent']);
    } else {
      throw new BadRequestException('不支持的 grant_type');
    }
  }

  @UseGuards(AuthGuard)
  @Get('userinfo')
  @ApiOperation({ summary: '获取用户信息' })
  @ApiResponse({ status: 200, description: '用户信息', type: UserInfoResponseDto })
  async getUserInfo(@CurrentUser('accessToken') accessToken: string) {
    return this.authService.getUserInfo(accessToken);
  }

  @Public()
  @Post('introspect')
  @ApiOperation({ summary: '验证 Token 有效性' })
  @ApiResponse({ status: 200, description: 'Token 状态', type: IntrospectResponseDto })
  async introspect(@Body() dto: IntrospectRequestDto) {
    return this.authService.introspectToken(dto.token);
  }

  @Public()
  @Post('revoke')
  @ApiOperation({ summary: '撤销 Token' })
  @ApiResponse({ status: 200, description: '撤销成功' })
  async revoke(@Body() dto: RevokeRequestDto) {
    await this.authService.revokeToken(dto.token);
    return { success: true };
  }

  @UseGuards(AuthGuard)
  @Get('logout')
  @ApiOperation({ summary: '单点登出' })
  @ApiResponse({ status: 200, description: '登出成功' })
  async logout(
    @CurrentUser('accessToken') accessToken: string,
    @CurrentUser('userId') userId: string,
    @Req() req: Request,
  ) {
    await this.authService.logout(accessToken, userId, this.getIpAddress(req), req.headers['user-agent']);
    return { success: true };
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'OAuth 登录（简化版）' })
  @ApiResponse({ status: 200, description: '登录成功' })
  async oauthLogin(
    @Body() body: { clientId: string; username: string; password: string; scope?: string },
    @Req() req: Request,
  ) {
    const loginResult = await this.usersService.login(
      { login: body.username, password: body.password },
      this.getIpAddress(req),
      req.headers['user-agent'],
    );

    const dto: AuthorizeDto = {
      clientId: body.clientId,
      redirectUri: 'http://localhost/callback',
      responseType: 'code',
      scope: body.scope?.split(' ') || ['openid', 'profile', 'email'],
    };

    const { code } = await this.authService.generateAuthorizationCode(
      dto,
      loginResult.user.id,
      this.getIpAddress(req),
      req.headers['user-agent'],
    );

    const tokenResponse = await this.authService.exchangeCodeForToken(
      {
        grantType: 'authorization_code',
        clientId: body.clientId,
        code,
        redirectUri: 'http://localhost/callback',
      },
      this.getIpAddress(req),
      req.headers['user-agent'],
    );

    return tokenResponse;
  }

  private async verifyToken(token: string): Promise<string> {
    const userId = await this.authService.introspectToken(token);
    if (!userId.active || !userId.sub) {
      throw new UnauthorizedException('无效的 Token');
    }
    return userId.sub;
  }

  private getIpAddress(req: Request): string {
    return req.headers['x-forwarded-for'] as string || '';
  }
}
