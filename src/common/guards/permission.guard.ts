import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permission.decorator';
import { permissionService } from '../services/permission.service';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 获取接口所需的权限
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // 如果没有设置权限要求，则放行
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userId = (request as any).user?.userId;

    if (!userId) {
      throw new ForbiddenException('无法获取用户信息');
    }

    // 检查用户是否为管理员（管理员拥有所有权限）
    const isAdmin = await permissionService.isAdmin(userId);
    if (isAdmin) {
      return true;
    }

    // 检查用户是否有所需权限
    for (const permission of requiredPermissions) {
      const hasPermission = await permissionService.hasPermission(userId, permission);
      if (!hasPermission) {
        throw new ForbiddenException(`缺少权限: ${permission}`);
      }
    }

    return true;
  }
}
