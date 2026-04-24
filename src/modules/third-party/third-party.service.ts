import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import axios from 'axios';
import { ThirdPartyAccount } from '../../database/entities/third-party-account.entity';
import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';
import { AuditEventType } from '../../database/entities/audit-log.entity';

export interface ThirdPartyUserInfo {
  provider: string;
  providerId: string;
  email: string;
  nickname?: string;
  avatar?: string;
}

@Injectable()
export class ThirdPartyService {
  constructor(
    @InjectRepository(ThirdPartyAccount)
    private thirdPartyRepo: Repository<ThirdPartyAccount>,
    private configService: ConfigService,
    private usersService: UsersService,
    private auditService: AuditService,
  ) {}

  getGithubAuthUrl(state: string): string {
    const clientID = this.configService.get<string>('github.clientID') || '';
    const callbackURL = this.configService.get<string>('github.callbackURL') || '';
    const scope = 'user:email';

    return `https://github.com/login/oauth/authorize?client_id=${clientID}&redirect_uri=${encodeURIComponent(callbackURL)}&scope=${scope}&state=${state}`;
  }

  async handleGithubCallback(code: string, ipAddress?: string, userAgent?: string): Promise<ThirdPartyUserInfo> {
    const clientID = this.configService.get<string>('github.clientID') || '';
    const clientSecret = this.configService.get<string>('github.clientSecret') || '';

    const tokenResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: clientID,
        client_secret: clientSecret,
        code,
      },
      {
        headers: { Accept: 'application/json' },
      },
    );

    const accessToken = tokenResponse.data.access_token;
    if (!accessToken) {
      throw new UnauthorizedException('GitHub 授权失败');
    }

    const userResponse = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const githubUser = userResponse.data;

    let email = githubUser.email;
    if (!email) {
      const emailResponse = await axios.get('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const primaryEmail = emailResponse.data.find((e: any) => e.primary && e.verified);
      email = primaryEmail?.email || emailResponse.data[0]?.email;
    }

    if (!email) {
      throw new UnauthorizedException('无法获取 GitHub 邮箱');
    }

    if (this.auditService) {
      this.auditService.createLog({
        eventType: AuditEventType.THIRD_PARTY_LOGIN,
        ipAddress,
        userAgent,
        requestParams: { provider: 'github' },
        responseStatus: 200,
      }).catch(console.error);
    }

    return {
      provider: 'github',
      providerId: String(githubUser.id),
      email,
      nickname: githubUser.name || githubUser.login,
      avatar: githubUser.avatar_url,
    };
  }

  getGoogleAuthUrl(state: string): string {
    const clientID = this.configService.get<string>('google.clientID') || '';
    const callbackURL = this.configService.get<string>('google.callbackURL') || '';
    const scope = encodeURIComponent('https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile');

    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientID}&redirect_uri=${encodeURIComponent(callbackURL)}&response_type=code&scope=${scope}&state=${state}&access_type=offline`;
  }

  async handleGoogleCallback(code: string, ipAddress?: string, userAgent?: string): Promise<ThirdPartyUserInfo> {
    const clientID = this.configService.get<string>('google.clientID') || '';
    const clientSecret = this.configService.get<string>('google.clientSecret') || '';
    const callbackURL = this.configService.get<string>('google.callbackURL') || '';

    const tokenResponse = await axios.post(
      'https://oauth2.googleapis.com/token',
      {
        client_id: clientID,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: callbackURL,
      },
    );

    const { access_token } = tokenResponse.data;

    const userResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const googleUser = userResponse.data;

    if (!googleUser.email) {
      throw new UnauthorizedException('无法获取 Google 邮箱');
    }

    if (this.auditService) {
      this.auditService.createLog({
        eventType: AuditEventType.THIRD_PARTY_LOGIN,
        ipAddress,
        userAgent,
        requestParams: { provider: 'google' },
        responseStatus: 200,
      }).catch(console.error);
    }

    return {
      provider: 'google',
      providerId: googleUser.id,
      email: googleUser.email,
      nickname: googleUser.name,
      avatar: googleUser.picture,
    };
  }

  getWechatAuthUrl(state: string): string {
    const appID = this.configService.get<string>('wechat.appID') || '';
    const callbackURL = this.configService.get<string>('wechat.callbackURL') || '';

    return `https://open.weixin.qq.com/connect/qrconnect?appid=${appID}&redirect_uri=${encodeURIComponent(callbackURL)}&response_type=code&scope=snsapi_login&state=${state}`;
  }

  async handleWechatCallback(code: string, ipAddress?: string, userAgent?: string): Promise<ThirdPartyUserInfo> {
    const appID = this.configService.get<string>('wechat.appID') || '';
    const appSecret = this.configService.get<string>('wechat.appSecret') || '';

    const tokenResponse = await axios.get(
      'https://api.weixin.qq.com/sns/oauth2/access_token',
      {
        params: {
          appid: appID,
          secret: appSecret,
          code,
          grant_type: 'authorization_code',
        },
      },
    );

    const { access_token, openid } = tokenResponse.data;

    if (!access_token || !openid) {
      throw new UnauthorizedException('微信授权失败');
    }

    const userResponse = await axios.get('https://api.weixin.qq.com/sns/userinfo', {
      params: { access_token, openid },
    });

    const wechatUser = userResponse.data;

    if (!wechatUser.unionid && !wechatUser.openid) {
      throw new UnauthorizedException('无法获取微信用户信息');
    }

    if (this.auditService) {
      this.auditService.createLog({
        eventType: AuditEventType.THIRD_PARTY_LOGIN,
        ipAddress,
        userAgent,
        requestParams: { provider: 'wechat' },
        responseStatus: 200,
      }).catch(console.error);
    }

    return {
      provider: 'wechat',
      providerId: wechatUser.unionid || wechatUser.openid,
      email: `${wechatUser.unionid || wechatUser.openid}@wechat.local`,
      nickname: wechatUser.nickname,
      avatar: wechatUser.headimgurl,
    };
  }

  async handleThirdPartyLogin(
    provider: string,
    code: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<ThirdPartyUserInfo> {
    let userInfo: ThirdPartyUserInfo;

    switch (provider) {
      case 'github':
        userInfo = await this.handleGithubCallback(code, ipAddress, userAgent);
        break;
      case 'google':
        userInfo = await this.handleGoogleCallback(code, ipAddress, userAgent);
        break;
      case 'wechat':
        userInfo = await this.handleWechatCallback(code, ipAddress, userAgent);
        break;
      default:
        throw new BadRequestException(`不支持的第三方登录: ${provider}`);
    }

    return userInfo;
  }

  async getUserThirdPartyAccounts(userId: string): Promise<ThirdPartyAccount[]> {
    return this.thirdPartyRepo.find({ where: { userId } });
  }

  async unbindThirdPartyAccount(userId: string, provider: string): Promise<void> {
    await this.thirdPartyRepo.delete({ userId, provider });
  }
}
