import { Injectable } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TenantMiddleware {
  constructor(private configService: ConfigService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const tenantEnabled = this.configService.get<boolean>('tenant.enabled');
    
    if (tenantEnabled === false) {
      // 多租户未启用，设置默认租户
      (req as any).tenantId = 'default';
      return next();
    }

    // 从 Header、Query 或 subdomain 获取租户ID
    const tenantId = 
      req.headers['x-tenant-id'] as string ||
      req.query['tenantId'] as string ||
      this.extractSubdomain(req);

    if (!tenantId) {
      // 对于公开接口（如 OAuth 回调）允许不提供租户ID
      const publicPaths = [
        '/api/oauth', 
        '/api/auth/github', 
        '/api/auth/google', 
        '/api/auth/wechat',
        '/api/auth/authorize',
        '/api/auth/token',
      ];
      const isPublicPath = publicPaths.some(path => req.path.startsWith(path));
      
      if (!isPublicPath) {
        res.status(400).json({
          code: 400,
          message: '缺少租户标识 (x-tenant-id 或 tenantId)',
        });
        return;
      }
    }

    (req as any).tenantId = tenantId || 'default';
    next();
  }

  private extractSubdomain(req: Request): string | undefined {
    const host = req.get('host') || '';
    const subdomain = host.split('.')[0];
    
    // 排除 www 和常见端口
    if (subdomain && subdomain !== 'www' && !subdomain.match(/^\d+$/)) {
      return subdomain;
    }
    
    return undefined;
  }
}
