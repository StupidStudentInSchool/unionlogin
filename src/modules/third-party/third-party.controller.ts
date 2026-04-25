import {
  Controller,
  Get,
  Delete,
  Query,
  Param,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import * as crypto from 'crypto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { thirdPartyAuthService } from './third-party.service';
import { usersService } from '../users/users.service';
import { Public } from '../../common/decorators/auth.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';

@ApiTags('第三方登录')
@Controller('api/auth')
export class ThirdPartyController {
  @Public()
  @Get('github')
  @ApiOperation({ summary: 'GitHub 登录入口' })
  githubLogin(@Res() res: Response) {
    const state = crypto.randomBytes(16).toString('hex');
    const authUrl = thirdPartyAuthService.getGithubAuthUrl(state);

    res.cookie('oauth_state', state, { httpOnly: true, maxAge: 300000 });
    return res.redirect(authUrl);
  }

  @Public()
  @Get('github/callback')
  @ApiOperation({ summary: 'GitHub 授权回调' })
  async githubCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    if (error) {
      return res.redirect(`${frontendUrl}/login?error=${error}`);
    }

    const savedState = (req as any).cookies?.oauth_state;
    if (state !== savedState) {
      return res.redirect(`${frontendUrl}/login?error=invalid_state`);
    }

    try {
      const userInfo = await thirdPartyAuthService.handleThirdPartyLogin(
        'github',
        code,
        this.getIpAddress(req),
        req.headers['user-agent'],
      );

      const user = await usersService.createOrUpdateThirdPartyUser(
        userInfo.provider,
        userInfo.providerId,
        userInfo.email,
        userInfo.nickname,
        userInfo.avatar,
      );

      res.clearCookie('oauth_state');

      const redirectUrl = new URL(`${frontendUrl}/auth/callback`);
      redirectUrl.searchParams.set('provider', 'github');
      redirectUrl.searchParams.set('userId', user.id);

      return res.redirect(redirectUrl.toString());
    } catch (err) {
      console.error('GitHub callback error:', err);
      return res.redirect(`${frontendUrl}/login?error=auth_failed`);
    }
  }

  @Public()
  @Get('google')
  @ApiOperation({ summary: 'Google 登录入口' })
  googleLogin(@Res() res: Response) {
    const state = crypto.randomBytes(16).toString('hex');
    const authUrl = thirdPartyAuthService.getGoogleAuthUrl(state);

    res.cookie('oauth_state', state, { httpOnly: true, maxAge: 300000 });
    return res.redirect(authUrl);
  }

  @Public()
  @Get('google/callback')
  @ApiOperation({ summary: 'Google 授权回调' })
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    if (error) {
      return res.redirect(`${frontendUrl}/login?error=${error}`);
    }

    const savedState = (req as any).cookies?.oauth_state;
    if (state !== savedState) {
      return res.redirect(`${frontendUrl}/login?error=invalid_state`);
    }

    try {
      const userInfo = await thirdPartyAuthService.handleThirdPartyLogin(
        'google',
        code,
        this.getIpAddress(req),
        req.headers['user-agent'],
      );

      const user = await usersService.createOrUpdateThirdPartyUser(
        userInfo.provider,
        userInfo.providerId,
        userInfo.email,
        userInfo.nickname,
        userInfo.avatar,
      );

      res.clearCookie('oauth_state');

      const redirectUrl = new URL(`${frontendUrl}/auth/callback`);
      redirectUrl.searchParams.set('provider', 'google');
      redirectUrl.searchParams.set('userId', user.id);

      return res.redirect(redirectUrl.toString());
    } catch (err) {
      console.error('Google callback error:', err);
      return res.redirect(`${frontendUrl}/login?error=auth_failed`);
    }
  }

  @Public()
  @Get('wechat')
  @ApiOperation({ summary: '微信登录入口' })
  wechatLogin(@Res() res: Response) {
    const state = crypto.randomBytes(16).toString('hex');
    const authUrl = thirdPartyAuthService.getWechatAuthUrl(state);

    res.cookie('oauth_state', state, { httpOnly: true, maxAge: 300000 });
    return res.redirect(authUrl);
  }

  @Public()
  @Get('wechat/callback')
  @ApiOperation({ summary: '微信授权回调' })
  async wechatCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    if (error) {
      return res.redirect(`${frontendUrl}/login?error=${error}`);
    }

    const savedState = (req as any).cookies?.oauth_state;
    if (state !== savedState) {
      return res.redirect(`${frontendUrl}/login?error=invalid_state`);
    }

    try {
      const userInfo = await thirdPartyAuthService.handleThirdPartyLogin(
        'wechat',
        code,
        this.getIpAddress(req),
        req.headers['user-agent'],
      );

      const user = await usersService.createOrUpdateThirdPartyUser(
        userInfo.provider,
        userInfo.providerId,
        userInfo.email,
        userInfo.nickname,
        userInfo.avatar,
      );

      res.clearCookie('oauth_state');

      const redirectUrl = new URL(`${frontendUrl}/auth/callback`);
      redirectUrl.searchParams.set('provider', 'wechat');
      redirectUrl.searchParams.set('userId', user.id);

      return res.redirect(redirectUrl.toString());
    } catch (err) {
      console.error('Wechat callback error:', err);
      return res.redirect(`${frontendUrl}/login?error=auth_failed`);
    }
  }

  @UseGuards(AuthGuard)
  @Get('third-party/accounts')
  @ApiOperation({ summary: '获取已绑定的第三方账户' })
  async getThirdPartyAccounts(@Req() req: Request) {
    const userId = (req as any).user?.userId;
    return thirdPartyAuthService.getUserThirdPartyAccounts(userId);
  }

  @UseGuards(AuthGuard)
  @Delete('third-party/:provider')
  @ApiOperation({ summary: '解绑第三方账户' })
  async unbindAccount(
    @Req() req: Request,
    @Param('provider') provider: string,
  ) {
    const userId = (req as any).user?.userId;
    await thirdPartyAuthService.unbindThirdPartyAccount(userId, provider);
    return { message: '解绑成功' };
  }

  private getIpAddress(req: Request): string {
    return (req.headers['x-forwarded-for'] as string) || '';
  }
}
