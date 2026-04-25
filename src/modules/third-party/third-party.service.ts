import axios from 'axios';
import {
  thirdPartyService,
  userService,
  auditService,
} from '../../storage/database/services';

interface ThirdPartyUserInfo {
  provider: string;
  providerId: string;
  email?: string;
  nickname?: string;
  avatar?: string;
}

export class ThirdPartyService {
  private config = {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      authUrl: 'https://github.com/login/oauth/authorize',
      tokenUrl: 'https://github.com/login/oauth/access_token',
      userUrl: 'https://api.github.com/user',
      scope: 'read:user user:email',
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      userUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
      scope: 'openid email profile',
    },
    wechat: {
      appId: process.env.WECHAT_APP_ID,
      appSecret: process.env.WECHAT_APP_SECRET,
      authUrl: 'https://open.weixin.qq.com/connect/qrconnect',
      tokenUrl: 'https://api.weixin.qq.com/sns/oauth2/access_token',
      userUrl: 'https://api.weixin.qq.com/sns/userinfo',
      scope: 'snsapi_login',
    },
  };

  getGithubAuthUrl(state: string): string {
    const { clientId, authUrl, scope } = this.config.github;
    if (!clientId) throw new Error('GitHub OAuth 未配置');

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: `${process.env.APP_URL}/auth/github/callback`,
      scope,
      state,
    });
    return `${authUrl}?${params.toString()}`;
  }

  getGoogleAuthUrl(state: string): string {
    const { clientId, authUrl, scope } = this.config.google;
    if (!clientId) throw new Error('Google OAuth 未配置');

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: `${process.env.APP_URL}/auth/google/callback`,
      response_type: 'code',
      scope,
      state,
      access_type: 'offline',
      prompt: 'consent',
    });
    return `${authUrl}?${params.toString()}`;
  }

  getWechatAuthUrl(state: string): string {
    const { appId, authUrl, scope } = this.config.wechat;
    if (!appId) throw new Error('微信 OAuth 未配置');

    const params = new URLSearchParams({
      appid: appId,
      redirect_uri: `${process.env.APP_URL}/auth/wechat/callback`,
      response_type: 'code',
      scope,
      state,
    });
    return `${authUrl}?${params.toString()}`;
  }

  async handleThirdPartyLogin(
    provider: 'github' | 'google' | 'wechat',
    code: string,
    ipAddress: string,
    userAgent?: string,
  ): Promise<ThirdPartyUserInfo> {
    switch (provider) {
      case 'github':
        return this.handleGithubCallback(code, ipAddress, userAgent);
      case 'google':
        return this.handleGoogleCallback(code, ipAddress, userAgent);
      case 'wechat':
        return this.handleWechatCallback(code, ipAddress, userAgent);
      default:
        throw new Error('不支持的第三方登录');
    }
  }

  private async handleGithubCallback(
    code: string,
    ipAddress: string,
    userAgent?: string,
  ): Promise<ThirdPartyUserInfo> {
    const { clientId, clientSecret, tokenUrl, userUrl } = this.config.github;
    if (!clientId || !clientSecret) throw new Error('GitHub OAuth 未配置');

    // 获取 access_token
    const tokenResponse = await axios.post(
      tokenUrl,
      {
        client_id: clientId,
        client_secret: clientSecret,
        code,
      },
      { headers: { Accept: 'application/json' } },
    );

    const accessToken = tokenResponse.data.access_token;

    // 获取用户信息
    const userResponse = await axios.get(userUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const userData = userResponse.data;

    await auditService.create({
      event_type: 'third_party_login',
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    return {
      provider: 'github',
      providerId: String(userData.id),
      email: userData.email,
      nickname: userData.name || userData.login,
      avatar: userData.avatar_url,
    };
  }

  private async handleGoogleCallback(
    code: string,
    ipAddress: string,
    userAgent?: string,
  ): Promise<ThirdPartyUserInfo> {
    const { clientId, clientSecret, tokenUrl, userUrl } = this.config.google;
    if (!clientId || !clientSecret) throw new Error('Google OAuth 未配置');

    // 获取 access_token
    const tokenResponse = await axios.post(tokenUrl, {
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: `${process.env.APP_URL}/auth/google/callback`,
      grant_type: 'authorization_code',
    });

    const accessToken = tokenResponse.data.access_token;

    // 获取用户信息
    const userResponse = await axios.get(userUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const userData = userResponse.data;

    await auditService.create({
      event_type: 'third_party_login',
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    return {
      provider: 'google',
      providerId: userData.id,
      email: userData.email,
      nickname: userData.name,
      avatar: userData.picture,
    };
  }

  private async handleWechatCallback(
    code: string,
    ipAddress: string,
    userAgent?: string,
  ): Promise<ThirdPartyUserInfo> {
    const { appId, appSecret, tokenUrl, userUrl } = this.config.wechat;
    if (!appId || !appSecret) throw new Error('微信 OAuth 未配置');

    // 获取 access_token
    const tokenResponse = await axios.get(tokenUrl, {
      params: {
        appid: appId,
        secret: appSecret,
        code,
        grant_type: 'authorization_code',
      },
    });

    const { access_token, openid } = tokenResponse.data;

    // 获取用户信息
    const userResponse = await axios.get(userUrl, {
      params: { access_token, openid },
    });

    const userData = userResponse.data;

    await auditService.create({
      event_type: 'third_party_login',
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    return {
      provider: 'wechat',
      providerId: openid,
      nickname: userData.nickname,
      avatar: userData.headimgurl,
    };
  }

  async getUserThirdPartyAccounts(userId: string) {
    return thirdPartyService.findByUserId(userId);
  }

  async unbindThirdPartyAccount(userId: string, provider: string) {
    await thirdPartyService.delete(userId, provider);
  }
}

export const thirdPartyAuthService = new ThirdPartyService();
