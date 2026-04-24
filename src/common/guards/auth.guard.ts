import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/auth.decorator';
import { sessionService } from '../../storage/database/services';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    // 公开接口跳过认证
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    
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

    // 验证 Token
    try {
      const introspection = await sessionService.findByAccessToken(token);
      
      if (!introspection) {
        throw new UnauthorizedException('Token 无效');
      }

      const expiresAt = new Date(introspection.expires_at);
      if (expiresAt < new Date()) {
        await sessionService.delete(token);
        throw new UnauthorizedException('Token 已过期');
      }

      // 将用户信息挂载到 request 上
      (request as any).user = {
        userId: introspection.user_id,
        accessToken: token,
      };
      
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Token 验证失败');
    }
  }
}
