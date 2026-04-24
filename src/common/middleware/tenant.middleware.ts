import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // 使用 baseUrl + path 或者直接使用 originalUrl
    const url = req.originalUrl || req.url;
    
    // 公开接口路径（不需要租户标识）
    const publicPaths = [
      'github',
      'google', 
      'wechat',
      'authorize',
      'token',
      'introspect',
      'revoke',
      'login',
      'register',
      'tenants',
    ];

    const isPublic = publicPaths.some(publicPath => 
      url.includes(publicPath)
    );

    if (isPublic) {
      (req as any).tenantId = req.headers['x-tenant-id'] as string || 'default';
      return next();
    }

    // 从 Header、Query 或 subdomain 获取租户ID
    const tenantId = 
      req.headers['x-tenant-id'] as string ||
      req.query['tenantId'] as string ||
      this.extractSubdomain(req);

    if (!tenantId) {
      res.status(400).json({
        code: 400,
        message: '缺少租户标识 (x-tenant-id 或 tenantId)',
      });
      return;
    }

    (req as any).tenantId = tenantId;
    next();
  }

  private extractSubdomain(req: Request): string | undefined {
    const host = req.get('host') || '';
    const parts = host.split('.');
    
    if (parts.length >= 3) {
      return parts[0];
    }
    
    return undefined;
  }
}
