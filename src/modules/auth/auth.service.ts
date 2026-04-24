import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../../database/entities/user.entity';
import { OAuthClient } from '../../database/entities/oauth-client.entity';
import { UserAuthorization } from '../../database/entities/user-authorization.entity';
import { RedisService } from '../../config/redis.service';
import { AuditService } from '../audit/audit.service';
import { AuditEventType } from '../../database/entities/audit-log.entity';
import { UsersService } from '../users/users.service';
import { AppsService } from '../apps/apps.service';
import {
  AuthorizeDto,
  TokenRequestDto,
  TokenResponseDto,
  UserInfoResponseDto,
  IntrospectResponseDto,
} from './dto/oauth.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(OAuthClient)
    private clientRepository: Repository<OAuthClient>,
    @InjectRepository(UserAuthorization)
    private authRepository: Repository<UserAuthorization>,
    private redisService: RedisService,
    private configService: ConfigService,
    @Inject(forwardRef(() => AuditService))
    private auditService: AuditService,
    @Inject(forwardRef(() => UsersService))
    private usersService: UsersService,
    @Inject(forwardRef(() => AppsService))
    private appsService: AppsService,
  ) {}

  async generateAuthorizationCode(
    dto: AuthorizeDto,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ code: string; state?: string }> {
    const client = await this.appsService.validateClient(dto.clientId);
    
    const isValidUri = await this.appsService.validateRedirectUri(dto.clientId, dto.redirectUri);
    if (!isValidUri) {
      throw new BadRequestException('重定向 URI 不在允许列表中');
    }

    const scopes = await this.appsService.validateScopes(dto.clientId, dto.scope || []);

    const code = crypto.randomBytes(32).toString('base64url');
    const codeExpireSeconds = this.configService.get<number>('oauth.authorizationCodeExpire') || 300;

    await this.redisService.setAuthorizationCode(
      code,
      {
        clientId: dto.clientId,
        userId,
        redirectUri: dto.redirectUri,
        scopes,
        state: dto.state,
      },
      codeExpireSeconds,
    );

    if (this.auditService) {
      this.auditService.createLog({
        eventType: AuditEventType.OAUTH_AUTHORIZE,
        userId,
        clientId: client.id,
        ipAddress,
        userAgent,
        requestParams: { clientId: dto.clientId, scopes },
        responseStatus: 200,
      }).catch(console.error);
    }

    return { code, state: dto.state };
  }

  async exchangeCodeForToken(
    dto: TokenRequestDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<TokenResponseDto> {
    const codeData = await this.redisService.getAuthorizationCode(dto.code || '');
    if (!codeData) {
      throw new UnauthorizedException('授权码已过期或无效');
    }

    await this.appsService.validateClient(dto.clientId, dto.clientSecret);

    if (codeData.redirectUri !== dto.redirectUri) {
      throw new BadRequestException('重定向 URI 不匹配');
    }

    await this.redisService.revokeAuthorizationCode(dto.code || '');

    const userId = codeData.userId;
    const tokenResponse = await this.generateTokens(userId, dto.clientId, codeData.scopes);

    if (this.auditService) {
      this.auditService.createLog({
        eventType: AuditEventType.OAUTH_TOKEN,
        userId,
        clientId: codeData.clientId,
        ipAddress,
        userAgent,
        requestParams: { grantType: 'authorization_code' },
        responseStatus: 200,
      }).catch(console.error);
    }

    return tokenResponse;
  }

  async refreshAccessToken(
    dto: TokenRequestDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<TokenResponseDto> {
    const userId = await this.redisService.getRefreshToken(dto.refreshToken || '');
    if (!userId) {
      throw new UnauthorizedException('Refresh Token 已过期或无效');
    }

    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    const auth = await this.authRepository.findOne({
      where: { userId, clientId: dto.clientId },
    });

    const scopes = auth?.scopes || ['openid', 'profile', 'email'];

    if (this.auditService) {
      this.auditService.createLog({
        eventType: AuditEventType.TOKEN_REFRESH,
        userId,
        clientId: dto.clientId,
        ipAddress,
        userAgent,
        responseStatus: 200,
      }).catch(console.error);
    }

    return this.generateTokens(userId, dto.clientId, scopes);
  }

  async getUserInfo(accessToken: string): Promise<UserInfoResponseDto> {
    const userId = await this.redisService.getAccessToken(accessToken);
    if (!userId) {
      throw new UnauthorizedException('Access Token 已过期或无效');
    }

    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    return {
      sub: user.id,
      username: user.username,
      email: user.email,
      emailVerified: user.emailVerified,
      nickname: user.nickname,
      picture: user.avatarUrl,
      updatedAt: Math.floor(user.updatedAt.getTime() / 1000),
    };
  }

  async introspectToken(token: string): Promise<IntrospectResponseDto> {
    const userId = await this.redisService.getAccessToken(token);
    
    if (!userId) {
      return { active: false };
    }

    const user = await this.usersService.findById(userId);
    if (!user) {
      return { active: false };
    }

    return {
      active: true,
      sub: user.id,
      username: user.username,
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    };
  }

  async revokeToken(token: string): Promise<void> {
    await this.redisService.revokeAccessToken(token);
    await this.redisService.revokeRefreshToken(token);
  }

  async logout(accessToken: string, userId?: string, ipAddress?: string, userAgent?: string): Promise<void> {
    await this.redisService.revokeAccessToken(accessToken);

    if (userId && this.auditService) {
      this.auditService.createLog({
        eventType: AuditEventType.LOGOUT,
        userId,
        ipAddress,
        userAgent,
        responseStatus: 200,
      }).catch(console.error);
    }
  }

  private async generateTokens(
    userId: string,
    clientId: string,
    scopes: string[],
  ): Promise<TokenResponseDto> {
    const accessTokenExpire = this.configService.get<number>('oauth.accessTokenExpire') || 3600;
    const refreshTokenExpire = this.configService.get<number>('oauth.refreshTokenExpire') || 604800;

    const accessToken = `at_${uuidv4()}`;
    const refreshToken = `rt_${uuidv4()}`;

    await this.redisService.setAccessToken(accessToken, userId, accessTokenExpire);
    await this.redisService.setRefreshToken(refreshToken, userId, refreshTokenExpire);

    let auth = await this.authRepository.findOne({
      where: { userId, clientId },
    });

    if (!auth) {
      auth = this.authRepository.create({
        id: uuidv4(),
        userId,
        clientId,
        scopes,
        accessToken,
        refreshToken,
        tokenExpiresAt: new Date(Date.now() + accessTokenExpire * 1000),
      });
    } else {
      auth.accessToken = accessToken;
      auth.refreshToken = refreshToken;
      auth.scopes = scopes;
      auth.tokenExpiresAt = new Date(Date.now() + accessTokenExpire * 1000);
    }

    await this.authRepository.save(auth);

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: accessTokenExpire,
      refreshToken,
      scope: scopes.join(' '),
    };
  }
}
