# Identity Center - AGENTS.md

## 项目概述

统一身份认证中心（Identity Center）是一个基于 OAuth 2.0 / OIDC 协议的身份认证系统，为所有业务应用提供统一用户管理、单点登录、第三方登录和多租户支持。

## 技术栈

- **框架**: NestJS 11 + TypeScript
- **数据库**: MySQL 8.0 + TypeORM
- **缓存**: Redis (ioredis)
- **认证协议**: OAuth 2.0 Authorization Code Flow
- **第三方登录**: GitHub, Google, 微信

## 目录结构

```
src/
├── config/                 # 配置模块
│   ├── configuration.ts     # 环境变量配置
│   ├── config.module.ts     # 配置模块定义
│   └── redis.service.ts     # Redis 服务
├── common/                 # 公共模块
│   ├── decorators/          # 装饰器 (@Public, @CurrentUser, @TenantId)
│   ├── guards/              # 守卫 (AuthGuard)
│   ├── filters/             # 异常过滤器
│   ├── interceptors/       # 响应拦截器
│   └── middleware/          # 中间件 (TenantMiddleware)
├── database/
│   ├── entities/            # 数据库实体
│   │   ├── user.entity.ts
│   │   ├── oauth-client.entity.ts
│   │   ├── user-authorization.entity.ts
│   │   ├── audit-log.entity.ts
│   │   ├── user-session.entity.ts
│   │   ├── tenant.entity.ts
│   │   └── third-party-account.entity.ts
│   └── init.ts              # 数据库初始化脚本
├── modules/
│   ├── auth/                # OAuth 2.0 认证模块
│   ├── users/               # 用户管理模块
│   ├── apps/                # 应用管理模块
│   ├── audit/               # 审计日志模块
│   ├── third-party/         # 第三方登录模块
│   └── tenant/              # 多租户模块
└── main.ts                  # 应用入口
```

## 常用命令

```bash
# 安装依赖
pnpm install

# 开发模式
pnpm start:dev

# 生产构建
pnpm build

# 生产运行
pnpm start:prod

# 运行测试
pnpm test

# 初始化数据库
pnpm ts-node src/database/init.ts

# TypeORM 迁移
pnpm migration:generate src/database/migrations/MigrationName
pnpm migration:run
```

## 环境变量

必需的环境变量（.env）：

```env
# 数据库
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=root123
DB_NAME=identity_center

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-secret-key

# 应用
APP_PORT=5000
FRONTEND_URL=http://localhost:3000

# 第三方登录（可选）
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
WECHAT_APP_ID=
WECHAT_APP_SECRET=
```

## API 文档

- Swagger UI: http://localhost:5000/api/docs

## 默认账户

- 用户名: `admin`
- 密码: `admin123`

## 开发规范

### 模块创建

每个模块应包含：
1. `*.module.ts` - 模块定义
2. `*.controller.ts` - 控制器
3. `*.service.ts` - 服务
4. `dto/*.ts` - 数据传输对象
5. `entities/*.ts` - 数据库实体（如需要）

### 命名规范

- 文件名: kebab-case (如 `user.service.ts`)
- 类名: PascalCase (如 `UserService`)
- 方法名: camelCase (如 `findById`)
- 数据库表名: snake_case (如 `user_authorizations`)

### 安全规范

1. 所有密码使用 bcrypt 加密（cost factor >= 12）
2. 敏感配置使用环境变量
3. API 使用 Bearer Token 认证
4. 实施 CSRF 防护（state 参数）

## 注意事项

- 多租户模式：请求 Header 中添加 `X-Tenant-Id`
- Token 存储在 Redis 中，默认 Access Token 1小时过期，Refresh Token 7天过期
- 授权码有效期 5 分钟，一次性使用
