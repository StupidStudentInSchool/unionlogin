# Identity Center - AGENTS.md

## 项目概述

统一身份认证中心（Identity Center）是一个基于 OAuth 2.0 / OIDC 协议的身份认证系统，为所有业务应用提供统一用户管理、单点登录、第三方登录和多租户支持。

## 技术栈

- **框架**: NestJS 11 + TypeScript
- **数据库**: Coze Supabase (PostgreSQL)
- **认证协议**: OAuth 2.0 Authorization Code Flow
- **第三方登录**: GitHub, Google, 微信

## 目录结构

```
src/
├── storage/database/         # 数据库层 (Supabase)
│   ├── supabase-client.ts    # Supabase 客户端
│   ├── services.ts           # 数据库服务层
│   └── shared/schema.ts      # 数据模型定义
├── modules/
│   ├── auth/                # OAuth 2.0 认证模块
│   │   ├── auth.service.ts
│   │   ├── auth.controller.ts
│   │   └── dto/oauth.dto.ts
│   ├── users/               # 用户管理模块
│   ├── apps/                # 应用管理模块
│   ├── third-party/         # 第三方登录模块
│   ├── audit/               # 审计日志模块
│   └── tenant/              # 多租户模块
└── common/                  # 公共模块
    ├── decorators/
    ├── guards/
    ├── filters/
    ├── interceptors/
    └── middleware/
```

## 数据库表

| 表名 | 说明 |
|------|------|
| tenants | 租户表 |
| users | 用户表 |
| oauth_clients | OAuth 客户端表 |
| user_authorizations | 授权记录表 |
| user_sessions | 用户会话表 |
| audit_logs | 审计日志表 |
| third_party_accounts | 第三方账户表 |

## API 文档

- Swagger UI: http://localhost:5000/api/docs

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
```

## 环境变量

可选环境变量（使用 Coze Supabase 时自动配置）：

```env
# Coze 平台自动注入
COZE_SUPABASE_URL=
COZE_SUPABASE_ANON_KEY=
COZE_SUPABASE_SERVICE_ROLE_KEY=

# 应用配置
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

## 开发规范

### Supabase SDK 使用

```typescript
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 服务端操作（绕过 RLS）
const client = getSupabaseClient();

// CRUD 操作
const { data, error } = await client.from('users').select('*').eq('id', userId);
if (error) throw new Error(`查询失败: ${error.message}`);
```

### 数据库表命名

- 表名：snake_case（如 `user_sessions`）
- 字段名：snake_case（如 `created_at`）

### 安全规范

1. 所有密码使用 bcrypt 加密（cost factor >= 12）
2. 敏感配置使用环境变量
3. API 使用 Bearer Token 认证
4. 实施 CSRF 防护（state 参数）

## 前端页面

静态 HTML 页面位于 `public/` 目录：

| 页面 | 路径 | 说明 |
|------|------|------|
| 首页 | `/` | 自动重定向到 setup 或 login |
| 初始设置 | `/setup.html` | 首次登录创建管理员和租户 |
| 登录 | `/login.html` | 用户登录页面 |
| 管理后台 | `/dashboard.html` | 应用和用户管理 |

### 页面流程

1. **首次访问** → `/setup.html` → 创建管理员和租户 → 跳转 `/dashboard.html`
2. **已有账号** → `/login.html` → 登录 → 跳转 `/dashboard.html`

### 技术特点

- 使用 Tailwind CSS CDN（开发环境）
- 响应式设计，支持移动端和桌面端
- OAuth 2.0 第三方登录按钮（GitHub, Google）
- 密码强度实时检测
- JWT Token 本地存储

## 注意事项

- 多租户模式：请求 Header 中添加 `X-Tenant-Id`
- Token 存储在数据库中，默认 Access Token 1小时过期，Refresh Token 7天过期
- 授权码有效期 5 分钟，一次性使用
