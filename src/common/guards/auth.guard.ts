import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { IS_PUBLIC_KEY, IS_SKIP_THIRD_PARTY_KEY } from '../decorators/auth.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private configService: ConfigService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const isSkipThirdParty = this.reflector.getAllAndOverride<boolean>(IS_SKIP_THIRD_PARTY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    
    // 公开接口跳过认证
    if (isPublic) {
      return true;
    }

    // 从 Header 获取 Token
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      throw new UnauthorizedException('缺少认证信息');
    }

    const [type, token] = authHeader.split(' ');
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('认证格式不正确');
    }

    // TODO: 验证 JWT Token
    // 这里先简单处理，后续会在 AuthModule 中完善
    try {
      // const payload = await this.verifyToken(token);
      // request.user = payload;
      return true;
    } catch (error) {
      throw new UnauthorizedException('Token 已过期或无效');
    }
  }
}
