import { Injectable } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class TenantMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
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
        '/api/auth/introspect',
        '/api/auth/login',
        '/api/users/register',
        '/api/users/login',
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
    const parts = host.split('.');
    
    // 例如: tenant.example.com -> tenant
    if (parts.length >= 3) {
      return parts[0];
    }
    
    return undefined;
  }
}
