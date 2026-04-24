import { Injectable, UnauthorizedException, BadRequestException, ConflictException, forwardRef, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { User, UserStatus } from '../../database/entities/user.entity';
import { ThirdPartyAccount } from '../../database/entities/third-party-account.entity';
import { RedisService } from '../../config/redis.service';
import { AuditService } from '../audit/audit.service';
import { AuditEventType } from '../../database/entities/audit-log.entity';
import { 
  RegisterDto, 
  LoginDto, 
  UpdateProfileDto, 
  ChangePasswordDto,
  UserResponseDto,
  TokenResponseDto 
} from './dto/user.dto';

@Injectable()
export class UsersService {
  private readonly BCRYPT_ROUNDS = 12;
  private readonly LOGIN_FAIL_LIMIT = 5;
  private readonly LOCK_DURATION_MINUTES = 15;

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(ThirdPartyAccount)
    private thirdPartyRepo: Repository<ThirdPartyAccount>,
    private redisService: RedisService,
    private configService: ConfigService,
    @Inject(forwardRef(() => AuditService))
    private auditService: AuditService,
  ) {}

  async register(dto: RegisterDto, ipAddress?: string, userAgent?: string): Promise<UserResponseDto> {
    // 检查用户名是否存在
    const existingUser = await this.userRepository.findOne({
      where: [{ username: dto.username }, { email: dto.email }],
    });

    if (existingUser) {
      if (existingUser.username === dto.username) {
        throw new ConflictException('用户名已存在');
      }
      throw new ConflictException('邮箱已被注册');
    }

    // 密码哈希
    const passwordHash = await bcrypt.hash(dto.password, this.BCRYPT_ROUNDS);

    // 创建用户
    const user = this.userRepository.create({
      id: uuidv4(),
      username: dto.username,
      email: dto.email,
      phone: dto.phone,
      passwordHash,
      nickname: dto.nickname || dto.username,
    });

    await this.userRepository.save(user);

    // 记录审计日志
    if (this.auditService) {
      this.auditService.createLog({
        eventType: AuditEventType.REGISTER,
        userId: user.id,
        ipAddress,
        userAgent,
        responseStatus: 201,
      }).catch(console.error);
    }

    return this.toUserResponse(user);
  }

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string): Promise<TokenResponseDto> {
    // 查找用户
    const user = await this.userRepository.findOne({
      where: [
        { username: dto.login },
        { email: dto.login },
      ],
    });

    if (!user) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    // 检查账户锁定
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMinutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new UnauthorizedException(`账户已被锁定，请在 ${remainingMinutes} 分钟后重试`);
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      // 增加登录失败次数
      await this.handleLoginFail(user);
      throw new UnauthorizedException('用户名或密码错误');
    }

    // 检查用户状态
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('账户已被禁用');
    }

    // 重置登录失败计数
    await this.userRepository.update(user.id, {
      loginFailCount: 0,
      lockedUntil: undefined,
      lastLoginAt: new Date(),
    });

    // 记录审计日志
    if (this.auditService) {
      this.auditService.createLog({
        eventType: AuditEventType.LOGIN,
        userId: user.id,
        ipAddress,
        userAgent,
        responseStatus: 200,
      }).catch(console.error);
    }

    // 生成 Token
    const tokenResponse = await this.generateTokens(user);

    return {
      ...tokenResponse,
      tokenType: 'Bearer',
      user: this.toUserResponse(user),
    };
  }

  async getProfile(userId: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('用户不存在');
    }
    return this.toUserResponse(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto, ipAddress?: string, userAgent?: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('用户不存在');
    }

    // 更新字段
    if (dto.nickname) user.nickname = dto.nickname;
    if (dto.avatarUrl) user.avatarUrl = dto.avatarUrl;
    if (dto.phone) {
      // 检查手机号是否已被其他用户使用
      const existingPhone = await this.userRepository.findOne({ 
        where: { phone: dto.phone } 
      });
      if (existingPhone && existingPhone.id !== userId) {
        throw new ConflictException('手机号已被其他用户使用');
      }
      user.phone = dto.phone;
    }

    await this.userRepository.save(user);

    // 记录审计日志
    if (this.auditService) {
      this.auditService.createLog({
        eventType: AuditEventType.PROFILE_UPDATE,
        userId,
        ipAddress,
        userAgent,
        responseStatus: 200,
      }).catch(console.error);
    }

    return this.toUserResponse(user);
  }

  async changePassword(userId: string, dto: ChangePasswordDto, ipAddress?: string, userAgent?: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('用户不存在');
    }

    // 验证旧密码
    const isOldPasswordValid = await bcrypt.compare(dto.oldPassword, user.passwordHash);
    if (!isOldPasswordValid) {
      throw new UnauthorizedException('旧密码不正确');
    }

    // 新密码哈希
    const newPasswordHash = await bcrypt.hash(dto.newPassword, this.BCRYPT_ROUNDS);
    user.passwordHash = newPasswordHash;

    await this.userRepository.save(user);

    // 记录审计日志
    if (this.auditService) {
      this.auditService.createLog({
        eventType: AuditEventType.PASSWORD_CHANGE,
        userId,
        ipAddress,
        userAgent,
        responseStatus: 200,
      }).catch(console.error);
    }
  }

  async getUserSessions(userId: string): Promise<Array<{ sessionId: string; deviceInfo: string }>> {
    return this.redisService.getUserSessions(userId);
  }

  async revokeSession(userId: string, sessionId: string, ipAddress?: string, userAgent?: string): Promise<void> {
    await this.redisService.revokeUserSession(userId, sessionId);

    // 记录审计日志
    if (this.auditService) {
      this.auditService.createLog({
        eventType: AuditEventType.SESSION_REVOKE,
        userId,
        ipAddress,
        userAgent,
        requestParams: { sessionId },
        responseStatus: 200,
      }).catch(console.error);
    }
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { username } });
  }

  async createOrUpdateThirdPartyUser(
    provider: string,
    providerId: string,
    email: string,
    nickname?: string,
    avatar?: string,
  ): Promise<User> {
    // 查找是否已存在第三方账户关联
    let thirdPartyAccount = await this.thirdPartyRepo.findOne({
      where: { provider, providerId },
    });

    if (thirdPartyAccount) {
      // 更新第三方账户信息
      const user = await this.userRepository.findOne({ where: { id: thirdPartyAccount.userId } });
      if (user) {
        // 更新用户头像和昵称
        if (avatar && !user.avatarUrl) user.avatarUrl = avatar;
        if (nickname && !user.nickname) user.nickname = nickname;
        await this.userRepository.save(user);
        return user;
      }
    }

    // 创建新用户
    const username = `${provider}_${providerId.substring(0, 8)}`;
    const tempPassword = await bcrypt.hash(uuidv4(), this.BCRYPT_ROUNDS);

    const user = this.userRepository.create({
      id: uuidv4(),
      username,
      email,
      nickname: nickname || username,
      avatarUrl: avatar,
      passwordHash: tempPassword,
    });

    await this.userRepository.save(user);

    // 创建第三方账户关联
    if (!thirdPartyAccount) {
      thirdPartyAccount = this.thirdPartyRepo.create({
        provider,
        providerId,
        userId: user.id,
        providerEmail: email,
        providerNickname: nickname,
        providerAvatar: avatar,
      });
      await this.thirdPartyRepo.save(thirdPartyAccount);
    }

    return user;
  }

  private async handleLoginFail(user: User): Promise<void> {
    const failCount = user.loginFailCount + 1;
    
    if (failCount >= this.LOGIN_FAIL_LIMIT) {
      const lockUntil = new Date(Date.now() + this.LOCK_DURATION_MINUTES * 60 * 1000);
      await this.userRepository.update(user.id, {
        loginFailCount: failCount,
        lockedUntil: lockUntil,
      });
    } else {
      await this.userRepository.update(user.id, {
        loginFailCount: failCount,
      });
    }
  }

  private async generateTokens(user: User): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const accessTokenExpire = this.configService.get<number>('oauth.accessTokenExpire') || 3600;
    const refreshTokenExpire = this.configService.get<number>('oauth.refreshTokenExpire') || 604800;
    
    // 生成 Access Token（简化版，实际应使用 JWT）
    const accessToken = `at_${uuidv4()}_${Date.now()}`;
    const refreshToken = `rt_${uuidv4()}_${Date.now()}`;

    // 存储到 Redis
    await this.redisService.setAccessToken(accessToken, user.id, accessTokenExpire);
    await this.redisService.setRefreshToken(refreshToken, user.id, refreshTokenExpire);

    return {
      accessToken,
      refreshToken,
      expiresIn: accessTokenExpire,
    };
  }

  private toUserResponse(user: User): UserResponseDto {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      phone: user.phone,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      status: user.status,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    };
  }
}
