import { registerAs } from '@nestjs/config';

export const databaseConfig = registerAs('database', () => ({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || 'root123',
  name: process.env.DB_NAME || 'identity_center',
  synchronize: process.env.DB_SYNC !== 'false',
  logging: process.env.DB_LOGGING === 'true',
}));

export const redisConfig = registerAs('redis', () => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0', 10),
}));

export const jwtConfig = registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET || 'default-secret-change-in-production',
  expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
}));

export const oauthConfig = registerAs('oauth', () => ({
  authorizationCodeExpire: parseInt(process.env.OAUTH_CODE_EXPIRE || '300', 10),
  accessTokenExpire: parseInt(process.env.OAUTH_ACCESS_EXPIRE || '3600', 10),
  refreshTokenExpire: parseInt(
    process.env.OAUTH_REFRESH_EXPIRE || '604800',
    10,
  ),
}));

export const appConfig = registerAs('app', () => ({
  host: process.env.APP_HOST || '0.0.0.0',
  port: parseInt(process.env.APP_PORT || '5000', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
}));

export const githubConfig = registerAs('github', () => ({
  clientID: process.env.GITHUB_CLIENT_ID || '',
  clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
  callbackURL:
    process.env.GITHUB_CALLBACK_URL ||
    'http://localhost:5000/api/auth/github/callback',
}));

export const googleConfig = registerAs('google', () => ({
  clientID: process.env.GOOGLE_CLIENT_ID || '',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  callbackURL:
    process.env.GOOGLE_CALLBACK_URL ||
    'http://localhost:5000/api/auth/google/callback',
}));

export const wechatConfig = registerAs('wechat', () => ({
  appID: process.env.WECHAT_APP_ID || '',
  appSecret: process.env.WECHAT_APP_SECRET || '',
  callbackURL:
    process.env.WECHAT_CALLBACK_URL ||
    'http://localhost:5000/api/auth/wechat/callback',
}));

export const tenantConfig = registerAs('tenant', () => ({
  enabled: process.env.TENANT_ENABLED === 'true',
}));
