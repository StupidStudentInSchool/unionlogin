# 统一身份认证中心 - 对接手册

## 目录

1. [系统概述](#1-系统概述)
2. [快速开始](#2-快速开始)
3. [用户体系设计](#3-用户体系设计)
4. [OAuth 2.0 对接](#4-oauth-20-对接)
5. [API 接口参考](#5-api-接口参考)
6. [SDK 对接示例](#6-sdk-对接示例)
7. [第三方登录集成](#7-第三方登录集成)
8. [常见问题](#8-常见问题)

---

## 1. 系统概述

### 1.1 什么是统一身份认证中心

统一身份认证中心（Identity Center）是一个集中管理用户身份和权限的系统，为所有业务应用提供：
- **统一用户管理**：注册、登录、个人信息管理
- **单点登录（SSO）**：一次登录，全站通行
- **OAuth 2.0 / OIDC 支持**：标准协议对接
- **第三方登录**：GitHub、Google
- **多租户支持**：支持多个组织隔离
- **组织架构管理**：部门、角色、权限

### 1.2 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                      业务应用 (SP)                           │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐          │
│  │ App A   │  │ App B   │  │ App C   │  │ App D   │  ...    │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘          │
└───────┼────────────┼────────────┼────────────┼───────────────┘
        │ OAuth2     │ OAuth2     │ OAuth2     │ OAuth2
        └────────────┴────────────┴────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                 统一身份认证中心 (IdP)                        │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  用户管理 │ OAuth 2.0 │ 第三方登录 │ 多租户 │ 审计    │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 核心概念

| 概念 | 说明 |
|------|------|
| **Client ID** | 应用的唯一标识符 |
| **Client Secret** | 应用密钥，用于验证应用身份 |
| **Authorization Code** | 授权码，一次性使用，用于换取 Token |
| **Access Token** | 访问令牌，用于调用 API |
| **Refresh Token** | 刷新令牌，用于续期 Access Token |
| **Scope** | 权限范围，如 `openid`, `profile`, `email` |

### 1.4 环境地址

| 环境 | 地址 |
|------|------|
| **生产环境** | https://unionlogin.coze.site |
| **API 文档** | https://unionlogin.coze.site/api/docs |

---

## 2. 快速开始

### 2.1 环境要求

- Node.js >= 18
- PostgreSQL >= 14 (使用 Coze Supabase)
- Redis >= 6.0 (可选)

### 2.2 配置步骤

**Step 1: 配置环境变量**

```env
# Coze 平台自动注入 Supabase 配置
COZE_SUPABASE_URL=your_supabase_url
COZE_SUPABASE_ANON_KEY=your_anon_key
COZE_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# 应用配置
APP_PORT=5000
FRONTEND_URL=http://localhost:3000

# 第三方登录（可选）
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

**Step 2: 启动服务**

```bash
# 开发模式
pnpm start:dev

# 生产模式
pnpm build
pnpm start:prod
```

**Step 3: 访问文档**

```
https://unionlogin.coze.site/api/docs
```

### 2.3 初始化流程

首次访问系统会自动跳转到初始化页面，需要：
1. 创建管理员账号
2. 创建默认租户
3. 配置系统基础信息

---

## 3. 用户体系设计

### 3.1 统一用户池模式

本系统采用**统一用户池**模式，所有用户统一在认证中心注册和管理，第三方应用不维护独立用户表。

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           统一用户池架构                                      │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────────────────┐
                    │        认证中心 (IdP)        │
                    │                             │
                    │  ┌───────────────────────┐  │
                    │  │      users 表         │  │
                    │  │  - 统一用户数据        │  │
                    │  │  - 所有应用共享        │  │
                    │  └───────────────────────┘  │
                    │                             │
                    │  ┌───────────────────────┐  │
                    │  │   user_sessions 表    │  │
                    │  │  - 统一会话管理        │  │
                    │  │  - 支持单点登出        │  │
                    │  └───────────────────────┘  │
                    └──────────────┬──────────────┘
                                   │
           ┌───────────────────────┼───────────────────────┐
           │                       │                       │
           ▼                       ▼                       ▼
    ┌─────────────┐         ┌─────────────┐         ┌─────────────┐
    │   App A     │         │   App B     │         │   App C     │
    │             │         │             │         │             │
    │ 不存用户表   │         │ 不存用户表   │         │ 不存用户表   │
    │ 只存会话：   │         │ 只存会话：   │         │ 只存会话：   │
    │ - user_id   │         │ - user_id   │         │ - user_id   │
    │ - token     │         │ - token     │         │ - token     │
    └─────────────┘         └─────────────┘         └─────────────┘
```

### 3.2 模式优势

| 对比项 | 统一用户池 ✅ | 独立用户表 |
|--------|-------------|-----------|
| 用户体验 | 一个账号，全站通行 | 每个应用都要注册 |
| 安全管理 | 密码策略统一管理 | 各应用标准不一 |
| 开发成本 | 第三方应用无需处理注册逻辑 | 需要同步、关联逻辑 |
| 数据一致性 | 用户信息唯一来源 | 容易出现数据不一致 |
| 单点登出 | 天然支持 | 需要额外实现 |

### 3.3 注册流程

```
用户 ──> 第三方应用 ──> 点击"注册" ──> 跳转认证中心注册页
                                              │
                                              ▼
                                    ┌─────────────────┐
                                    │   认证中心       │
                                    │  注册页面        │
                                    │                 │
                                    │ - 用户名        │
                                    │ - 邮箱          │
                                    │ - 密码          │
                                    │ - 手机号(可选)   │
                                    └────────┬────────┘
                                             │
                                             ▼
                                    ┌─────────────────┐
                                    │   创建用户       │
                                    │  (users 表)      │
                                    └────────┬────────┘
                                             │
                     ┌───────────────────────┴───────────────────────┐
                     │                                               │
                     ▼                                               ▼
            ┌─────────────────┐                           ┌─────────────────┐
            │  自动登录        │                           │  记录审计日志    │
            │  创建会话        │                           │  (audit_logs)   │
            └────────┬────────┘                           └─────────────────┘
                     │
                     ▼
            ┌─────────────────┐
            │ 重定向回应用      │
            │ 携带授权码       │
            └────────┬────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           回到第三方应用                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                     │
                     ▼
            ┌─────────────────┐
            │ 用授权码换Token  │
            │ 获取用户信息     │
            └────────┬────────┘
                     │
                     ▼
            ┌─────────────────┐
            │ 创建本地会话     │
            │ 存储:           │
            │ - user_id       │
            │ - access_token  │
            └─────────────────┘
```

### 3.4 登录流程（完整业务链路）

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Step 1: 发起登录                                │
└─────────────────────────────────────────────────────────────────────────────┘

用户 ──> [应用 A] ──> 点击"登录" ──> 生成 state 参数，存储到 session
                                           │
                                           ▼
                            GET /api/auth/authorize?
                                client_id=app_a_id&
                                redirect_uri=https://app-a.com/callback&
                                response_type=code&
                                scope=openid profile email&
                                state=xyz123


┌─────────────────────────────────────────────────────────────────────────────┐
│                              Step 2: 认证中心处理                             │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────────┐
                              │   认证中心       │
                              └────────┬────────┘
                                       │
                               ┌───────┴───────┐
                               │               │
                          [已登录]         [未登录]
                               │               │
                               │               ▼
                               │    ┌─────────────────┐
                               │    │   显示登录页     │
                               │    │  /login.html    │
                               │    └────────┬────────┘
                               │             │
                               │             ▼
                               │    ┌─────────────────┐
                               │    │ 验证用户凭证     │
                               │    │ 创建用户会话     │
                               │    └────────┬────────┘
                               │             │
                               └──────┬──────┘
                                      │
                                      ▼
                             ┌─────────────────┐
                             │ 检查授权记录     │
                             └────────┬────────┘
                                      │
                              ┌───────┴───────┐
                              │               │
                        [已授权过]        [首次授权]
                              │               │
                              │               ▼
                              │    ┌─────────────────┐
                              │    │   显示授权页     │
                              │    │ [同意] [拒绝]    │
                              │    └────────┬────────┘
                              │             │
                              └──────┬──────┘
                                     │
                                     ▼
                            ┌─────────────────┐
                            │ 生成授权码       │
                            │ 5分钟有效        │
                            └────────┬────────┘
                                     │
                                     ▼
                            ┌─────────────────┐
                            │ 重定向回应用      │
                            │ ?code=xxx&state=xxx
                            └─────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                              Step 3: 应用处理回调                             │
└─────────────────────────────────────────────────────────────────────────────┘

                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
                    ▼                ▼                ▼
            ┌───────────┐    ┌───────────┐    ┌───────────┐
            │验证 state │    │用 code 换 │    │获取用户信息│
            │防止CSRF   │    │  Token    │    │           │
            └───────────┘    └───────────┘    └───────────┘
                                     │
                                     ▼
                            ┌─────────────────┐
                            │ 创建应用会话      │
                            │ 只存储:          │
                            │ - user_id       │
                            │ - access_token  │
                            └────────┬────────┘
                                     │
                                     ▼
                            ┌─────────────────┐
                            │ 登录完成         │
                            └─────────────────┘
```

### 3.5 单点登录 (SSO)

用户已在 App A 登录，访问 App B 时无需再次登录：

```
用户 → App B → 点击"登录" → OAuth 授权流程
                                    │
                                    ▼
                          ┌─────────────────┐
                          │ 认证中心检测到   │
                          │ 用户已登录       │
                          └────────┬────────┘
                                   │
                                   ▼
                          ┌─────────────────┐
                          │ 直接返回授权码   │
                          │ 无需再次登录     │
                          └────────┬────────┘
                                   │
                                   ▼
                          ┌─────────────────┐
                          │ App B 获取 Token │
                          │ 用户无缝登录     │
                          └─────────────────┘
```

### 3.6 单点登出

用户在任一应用登出，所有应用会话同步失效：

```
用户 → App A → 点击"登出"
                    │
                    ▼
           ┌─────────────────┐
           │ 调用认证中心     │
           │ /api/auth/logout │
           └────────┬────────┘
                    │
                    ▼
           ┌─────────────────┐
           │ 撤销 Token       │
           │ 删除会话记录     │
           └────────┬────────┘
                    │
                    ▼
           ┌─────────────────┐
           │ 所有应用的会话   │
           │ 都已失效        │
           └─────────────────┘
```

### 3.7 第三方应用接入步骤

第三方应用只需要做两件事：

**1. 登录入口 - 跳转到认证中心**

```javascript
function login() {
  const state = generateRandomState();
  sessionStorage.setItem('oauth_state', state);
  
  window.location.href = 'https://unionlogin.coze.site/api/auth/authorize?' + 
    new URLSearchParams({
      client_id: 'your_client_id',
      redirect_uri: 'https://your-app.com/callback',
      response_type: 'code',
      scope: 'openid profile email',
      state: state
    });
}
```

**2. 回调处理 - 用授权码换取用户信息**

```javascript
async function handleCallback(code) {
  // 换取 Token
  const tokenRes = await fetch('https://unionlogin.coze.site/api/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: 'your_client_id',
      client_secret: 'your_client_secret',
      code: code,
      redirect_uri: 'https://your-app.com/callback'
    })
  });
  const { access_token } = await tokenRes.json();
  
  // 获取用户信息
  const userRes = await fetch('https://unionlogin.coze.site/api/auth/userinfo', {
    headers: { 'Authorization': `Bearer ${access_token}` }
  });
  const user = await userRes.json();
  
  // 创建本地会话（只存 user_id 和 token，不存用户详细信息）
  session.user_id = user.sub;
  session.access_token = access_token;
}
```

### 3.8 用户应用权限管理

系统支持对用户进行应用级别的授权管理，控制用户可以访问哪些应用。

#### 权限模型

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           用户应用权限模型                                     │
└─────────────────────────────────────────────────────────────────────────────┘

                          ┌─────────────────┐
                          │    应用列表      │
                          │  (全局共享)      │
                          │                 │
                          │  - 应用A        │
                          │  - 应用B        │
                          │  - 应用C        │
                          └────────┬────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
                    ▼                             ▼
          ┌─────────────────┐           ┌─────────────────┐
          │   管理员角色     │           │   普通用户       │
          │  (role=admin)   │           │                 │
          └────────┬────────┘           └────────┬────────┘
                   │                             │
                   │                             │
                   ▼                             ▼
          ┌─────────────────┐           ┌─────────────────┐
          │  默认拥有所有     │           │ user_app_permissions
          │   应用权限       │           │  (授权关联表)    │
          └─────────────────┘           └────────┬────────┘
                                                 │
                                                 ▼
                                        ┌─────────────────┐
                                        │   已授权应用     │
                                        └─────────────────┘
```

#### 设计理念

1. **应用全局共享**：应用是平台级的资源，所有用户看到的应用列表相同
2. **用户租户隔离**：用户数据按租户隔离，但应用访问权限跨租户
3. **权限灵活配置**：通过授权机制控制用户能访问哪些应用
4. **管理员特权**：管理员默认拥有所有应用的访问权限

#### 权限规则

1. **管理员默认权限**：拥有 `admin` 角色的用户默认拥有所有应用的访问权限
2. **普通用户权限**：需要管理员显式授权才能访问应用
3. **权限检查时机**：OAuth 授权流程中会检查用户是否有权访问该应用
4. **权限拒绝**：无权限的用户访问应用时会收到 `access_denied` 错误

#### 授权流程图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           用户访问应用授权流程                                  │
└─────────────────────────────────────────────────────────────────────────────┘

    用户 → 应用 → OAuth 授权请求 → 认证中心
                                          │
                                          ▼
                                ┌─────────────────┐
                                │   用户已登录？   │
                                └────────┬────────┘
                                         │
                              ┌──────────┴──────────┐
                              │                     │
                          [已登录]              [未登录]
                              │                     │
                              │                     ▼
                              │           ┌─────────────────┐
                              │           │   显示登录页面   │
                              │           └────────┬────────┘
                              │                    │
                              └──────────┬─────────┘
                                         │
                                         ▼
                                ┌─────────────────┐
                                │  检查应用权限    │
                                └────────┬────────┘
                                         │
                              ┌──────────┴──────────┐
                              │                     │
                          [有权限]              [无权限]
                              │                     │
                              │                     ▼
                              │           ┌─────────────────┐
                              │           │ 返回错误：       │
                              │           │ access_denied   │
                              │           └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ 生成授权码       │
                    │ 返回给应用       │
                    └─────────────────┘
```

#### API 使用示例

**获取用户授权的应用列表**

```bash
GET /api/users/{userId}/apps
Authorization: Bearer {token}
```

响应：

```json
{
  "data": [
    {
      "id": "app-uuid-1",
      "name": "应用A",
      "client_id": "xxx",
      "hasPermission": true,
      "isGrantedByDefault": false,
      "grantedAt": "2024-01-01T00:00:00Z"
    },
    {
      "id": "app-uuid-2",
      "name": "应用B",
      "client_id": "yyy",
      "hasPermission": false,
      "isGrantedByDefault": false
    }
  ]
}
```

**授权用户访问应用**

```bash
POST /api/users/{userId}/apps
Authorization: Bearer {token}
Content-Type: application/json

{
  "appId": "app-uuid-2"
}
```

**批量授权用户访问多个应用**

```bash
POST /api/users/{userId}/apps/batch
Authorization: Bearer {token}
Content-Type: application/json

{
  "appIds": ["app-uuid-1", "app-uuid-2", "app-uuid-3"]
}
```

**取消用户应用授权**

```bash
DELETE /api/users/{userId}/apps/{appId}
Authorization: Bearer {token}
```

**检查用户是否有权访问应用**

```bash
GET /api/users/{userId}/apps/{appId}/check
Authorization: Bearer {token}
```

响应：

```json
{
  "hasPermission": true
}
```

#### 管理后台操作

在管理后台的用户列表中，每个用户右侧有一个"管理应用权限"按钮（钥匙图标）：

1. 点击按钮打开应用权限管理弹窗
2. 查看用户当前的应用权限状态
3. 点击"授权"按钮为用户授权应用访问权限
4. 点击"取消"按钮撤销用户的应用访问权限
5. 管理员用户的权限显示为"默认授权"，不可撤销

---

## 4. OAuth 2.0 对接

### 4.1 对接流程

```
1. 用户访问应用 → 应用重定向到 IdP 授权页面
2. 用户在 IdP 登录并授权
3. IdP 返回授权码 (Authorization Code)
4. 应用使用授权码换取 Access Token
5. 应用使用 Access Token 调用用户信息 API
6. 应用创建本地会话
```

### 4.2 注册应用

在管理后台创建应用，获取 `client_id` 和 `client_secret`：

**创建应用请求：**

```bash
POST /api/apps
Content-Type: application/json
Authorization: Bearer {admin_token}

{
  "name": "My Application",
  "redirectUris": ["https://your-app.com/callback"],
  "scopes": ["openid", "profile", "email"]
}
```

**响应：**

```json
{
  "app": {
    "id": "uuid-xxx",
    "client_id": "a1b2c3d4e5f6...",
    "name": "My Application",
    "redirect_uris": ["https://your-app.com/callback"],
    "scopes": ["openid", "profile", "email"],
    "status": "active",
    "created_at": "2024-01-01T00:00:00Z",
    "tenant_id": "tenant-uuid"
  },
  "clientSecret": "s3cr3t..."
}
```

> **注意**：`clientSecret` 在创建时返回，请妥善保管。如需查看可通过管理后台或 API 获取。

### 4.3 授权码模式对接

#### Step 1: 构建授权 URL

```
GET https://unionlogin.coze.site/api/auth/authorize
```

参数：

| 参数 | 必填 | 说明 |
|------|------|------|
| client_id | 是 | 应用的 Client ID |
| redirect_uri | 是 | 授权成功后的回调地址 |
| response_type | 是 | 固定为 `code` |
| scope | 否 | 权限范围，默认 `openid profile email` |
| state | 推荐 | CSRF 防护随机字符串 |

示例：

```
https://unionlogin.coze.site/api/auth/authorize?client_id=a1b2c3d4e5f6&redirect_uri=https://your-app.com/callback&response_type=code&scope=openid%20profile%20email&state=random_string_xyz
```

#### Step 2: 处理回调

用户在 IdP 登录授权后，会重定向到你的回调地址：

```
https://your-app.com/callback?code=auth_code_xxx&state=random_string_xyz
```

**验证 state 参数**：

```javascript
// 验证 state 防止 CSRF 攻击
if (state !== savedState) {
  throw new Error('Invalid state');
}
```

#### Step 3: 换取 Access Token

```bash
POST https://unionlogin.coze.site/api/auth/token
Content-Type: application/json

{
  "grant_type": "authorization_code",
  "client_id": "a1b2c3d4e5f6",
  "client_secret": "your_client_secret",
  "code": "auth_code_xxx",
  "redirect_uri": "https://your-app.com/callback"
}
```

响应：

```json
{
  "access_token": "at_xxxxx",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "rt_xxxxx",
  "scope": "openid profile email"
}
```

#### Step 4: 获取用户信息

```bash
GET https://unionlogin.coze.site/api/auth/userinfo
Authorization: Bearer at_xxxxx
```

响应：

```json
{
  "sub": "user-uuid-xxx",
  "username": "zhangsan",
  "email": "zhangsan@example.com",
  "nickname": "张三",
  "avatar": "https://example.com/avatar.jpg"
}
```

### 4.4 Token 刷新

当 Access Token 过期时，使用 Refresh Token 获取新的 Access Token：

```bash
POST https://unionlogin.coze.site/api/auth/token
Content-Type: application/json

{
  "grant_type": "refresh_token",
  "refresh_token": "rt_xxxxx"
}
```

### 4.5 Token 验证

业务应用可以验证 Token 的有效性：

```bash
POST https://unionlogin.coze.site/api/auth/introspect
Content-Type: application/json

{
  "token": "at_xxxxx"
}
```

响应：

```json
{
  "active": true,
  "sub": "user-uuid-xxx",
  "username": "zhangsan",
  "exp": 1704070800,
  "iat": 1704067200
}
```

### 4.6 Token 撤销

```bash
POST https://unionlogin.coze.site/api/auth/revoke
Content-Type: application/json

{
  "token": "at_xxxxx"
}
```

---

## 5. API 接口参考

### 5.1 用户管理

| 接口 | 方法 | 说明 | 认证 |
|------|------|------|------|
| `/api/users/register` | POST | 用户注册 | 否 |
| `/api/users/login` | POST | 用户登录 | 否 |
| `/api/users/profile` | GET | 获取当前用户 | Bearer Token |
| `/api/users/profile` | PUT | 更新个人信息 | Bearer Token |
| `/api/users/password` | PUT | 修改密码 | Bearer Token |
| `/api/users` | GET | 获取用户列表 | Bearer Token |
| `/api/users/stats` | GET | 获取统计数据 | Bearer Token |
| `/api/users/:id/department` | PUT | 分配用户部门 | Bearer Token |
| `/api/users/:id/apps` | GET | 获取用户授权的应用列表 | Bearer Token |
| `/api/users/:id/apps` | POST | 授权用户访问应用 | Bearer Token |
| `/api/users/:id/apps/batch` | POST | 批量授权用户访问应用 | Bearer Token |
| `/api/users/:id/apps/:appId` | DELETE | 取消用户应用授权 | Bearer Token |
| `/api/users/:id/apps/:appId/check` | GET | 检查用户应用权限 | Bearer Token |

#### 用户注册

```bash
POST /api/users/register
Content-Type: application/json

{
  "username": "zhangsan",
  "email": "zhangsan@example.com",
  "password": "your_password",
  "nickname": "张三"  // 可选
}
```

响应：

```json
{
  "success": true,
  "data": {
    "id": "user-uuid-xxx",
    "username": "zhangsan",
    "email": "zhangsan@example.com",
    "nickname": "张三",
    "status": "active",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

#### 用户登录

```bash
POST /api/users/login
Content-Type: application/json

{
  "login": "zhangsan",  // 用户名或邮箱
  "password": "your_password"
}
```

响应：

```json
{
  "success": true,
  "data": {
    "accessToken": "at_xxxxx",
    "refreshToken": "rt_xxxxx",
    "user": {
      "id": "user-uuid-xxx",
      "username": "zhangsan",
      "email": "zhangsan@example.com",
      "nickname": "张三",
      "tenant_id": "tenant-uuid"
    }
  }
}
```

### 5.2 OAuth 2.0

| 接口 | 方法 | 说明 | 认证 |
|------|------|------|------|
| `/api/auth/authorize` | GET | 授权入口 | 可选 |
| `/api/auth/token` | POST | 获取/刷新 Token | 否 |
| `/api/auth/userinfo` | GET | 获取用户信息 | Bearer Token |
| `/api/auth/introspect` | POST | 验证 Token | 否 |
| `/api/auth/revoke` | POST | 撤销 Token | 否 |
| `/api/auth/logout` | POST | 单点登出 | Bearer Token |

### 5.3 应用管理

| 接口 | 方法 | 说明 | 认证 |
|------|------|------|------|
| `/api/apps` | GET | 应用列表 | Bearer Token |
| `/api/apps` | POST | 创建应用 | Bearer Token |
| `/api/apps/:clientId` | GET | 应用详情 | 否 |
| `/api/apps/:clientId` | PUT | 更新应用 | Bearer Token |
| `/api/apps/:clientId` | DELETE | 删除应用 | Bearer Token |
| `/api/apps/:clientId/secret` | GET | 获取应用密钥 | Bearer Token |
| `/api/apps/:clientId/regenerate-secret` | POST | 重新生成密钥 | Bearer Token |

**删除应用说明**：

删除应用时会级联删除以下关联数据：
- `user_app_permissions` - 用户对该应用的授权记录
- `user_authorizations` - 该应用的授权码记录

```bash
DELETE /api/apps/:clientId
Authorization: Bearer {token}
```

响应：

```json
{
  "success": true,
  "message": "删除成功"
}
```
| `/api/apps/:clientId/regenerate-secret` | POST | 重新生成密钥 | Bearer Token |

### 5.4 租户管理

| 接口 | 方法 | 说明 | 认证 |
|------|------|------|------|
| `/api/tenants` | GET | 租户列表 | 否 |
| `/api/tenants` | POST | 创建租户 | 否 |
| `/api/tenants/:id` | GET | 租户详情 | 否 |

### 5.5 组织架构

| 接口 | 方法 | 说明 | 认证 |
|------|------|------|------|
| `/api/departments` | GET | 部门列表 | Bearer Token |
| `/api/departments` | POST | 创建部门 | Bearer Token |
| `/api/departments/:id` | PUT | 更新部门 | Bearer Token |
| `/api/departments/:id` | DELETE | 删除部门 | Bearer Token |
| `/api/roles` | GET | 角色列表 | Bearer Token |
| `/api/roles` | POST | 创建角色 | Bearer Token |
| `/api/roles/:id` | PUT | 更新角色 | Bearer Token |
| `/api/roles/:id` | DELETE | 删除角色 | Bearer Token |
| `/api/roles/assign` | POST | 分配角色 | Bearer Token |
| `/api/roles/user/:userId` | GET | 获取用户角色 | Bearer Token |

### 5.6 审计日志

| 接口 | 方法 | 说明 | 认证 |
|------|------|------|------|
| `/api/audit/logs` | GET | 查询审计日志 | Bearer Token |

### 5.7 第三方登录

| 接口 | 方法 | 说明 | 认证 |
|------|------|------|------|
| `/api/auth/github` | GET | GitHub 登录入口 | 否 |
| `/api/auth/github/callback` | GET | GitHub 回调 | 否 |
| `/api/auth/google` | GET | Google 登录入口 | 否 |
| `/api/auth/google/callback` | GET | Google 回调 | 否 |

---

## 6. SDK 对接示例

### 6.1 前端 JavaScript 对接

```javascript
// identity-sdk.js
class IdentityCenter {
  constructor(options) {
    this.baseUrl = options.baseUrl || 'https://unionlogin.coze.site';
    this.clientId = options.clientId;
    this.clientSecret = options.clientSecret;
    this.redirectUri = options.redirectUri;
    this.scope = options.scope || 'openid profile email';
  }

  // 生成随机 state
  generateState() {
    return Math.random().toString(36).substring(2, 15);
  }

  // 跳转到登录页
  login() {
    const state = this.generateState();
    sessionStorage.setItem('oauth_state', state);
    
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: this.scope,
      state,
    });
    
    window.location.href = `${this.baseUrl}/api/auth/authorize?${params}`;
  }

  // 处理回调
  async handleCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');
    
    if (error) {
      throw new Error(`OAuth error: ${error}`);
    }
    
    const savedState = sessionStorage.getItem('oauth_state');
    if (state !== savedState) {
      throw new Error('Invalid state - possible CSRF attack');
    }
    
    // 获取 Token
    const response = await fetch(`${this.baseUrl}/api/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        redirect_uri: this.redirectUri,
      }),
    });
    
    const data = await response.json();
    
    // 保存 Token
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    
    return data;
  }

  // 获取用户信息
  async getUserInfo() {
    const token = localStorage.getItem('access_token');
    const response = await fetch(`${this.baseUrl}/api/auth/userinfo`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    
    if (!response.ok) {
      throw new Error('Failed to get user info');
    }
    
    return response.json();
  }

  // 刷新 Token
  async refreshToken() {
    const refreshToken = localStorage.getItem('refresh_token');
    
    const response = await fetch(`${this.baseUrl}/api/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });
    
    const data = await response.json();
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    
    return data;
  }

  // 检查登录状态
  isAuthenticated() {
    return !!localStorage.getItem('access_token');
  }

  // 登出
  async logout() {
    const token = localStorage.getItem('access_token');
    if (token) {
      await fetch(`${this.baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
      });
    }
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }
}

// 使用示例
const identity = new IdentityCenter({
  baseUrl: 'https://unionlogin.coze.site',
  clientId: 'your_client_id',
  clientSecret: 'your_client_secret',
  redirectUri: 'https://your-app.com/callback',
});

// 登录
identity.login();

// 回调处理（在 callback 页面调用）
const tokens = await identity.handleCallback();
console.log(tokens);

// 获取用户信息
const userInfo = await identity.getUserInfo();
console.log(userInfo);

// 检查登录状态
if (identity.isAuthenticated()) {
  // 已登录
}

// 登出
await identity.logout();
```

### 6.2 Node.js 后端对接

```javascript
// server.js
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const session = require('express-session');

const app = express();

const IDP_BASE_URL = 'https://unionlogin.coze.site';
const CLIENT_ID = 'your_client_id';
const CLIENT_SECRET = 'your_client_secret';
const REDIRECT_URI = 'https://your-app.com/auth/callback';

app.use(session({
  secret: 'your-session-secret',
  resave: false,
  saveUninitialized: false,
}));

// 登录入口
app.get('/auth/login', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  req.session.oauthState = state;
  
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'openid profile email',
    state,
  });
  
  res.redirect(`${IDP_BASE_URL}/api/auth/authorize?${params}`);
});

// 回调处理
app.get('/auth/callback', async (req, res) => {
  const { code, state, error } = req.query;
  
  if (error) {
    return res.redirect(`/login?error=${error}`);
  }
  
  if (state !== req.session.oauthState) {
    return res.redirect('/login?error=invalid_state');
  }
  
  try {
    // 换取 Token
    const tokenResponse = await axios.post(`${IDP_BASE_URL}/api/auth/token`, {
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      redirect_uri: REDIRECT_URI,
    });
    
    const { access_token, refresh_token } = tokenResponse.data;
    
    // 获取用户信息
    const userResponse = await axios.get(`${IDP_BASE_URL}/api/auth/userinfo`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    
    const user = userResponse.data;
    
    // 创建本地会话
    req.session.user = {
      id: user.sub,
      username: user.username,
      email: user.email,
      accessToken: access_token,
      refreshToken: refresh_token,
    };
    
    res.redirect('/dashboard');
  } catch (err) {
    console.error('OAuth error:', err);
    res.redirect('/login?error=auth_failed');
  }
});

// 受保护的路由
app.get('/dashboard', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }
  res.json({ user: req.session.user });
});

// 登出
app.post('/auth/logout', async (req, res) => {
  if (req.session.user?.accessToken) {
    try {
      await axios.post(`${IDP_BASE_URL}/api/auth/revoke`, {
        token: req.session.user.accessToken,
      });
    } catch (e) {
      console.error('Revoke error:', e);
    }
  }
  req.session.destroy();
  res.json({ success: true });
});

app.listen(3000, () => {
  console.log('App running on http://localhost:3000');
});
```

### 6.3 Python (FastAPI) 对接

```python
# main.py
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
import httpx
import secrets

app = FastAPI()

IDP_BASE_URL = "https://unionlogin.coze.site"
CLIENT_ID = "your_client_id"
CLIENT_SECRET = "your_client_secret"
REDIRECT_URI = "https://your-app.com/auth/callback"

sessions = {}


# 登录入口
@app.get("/auth/login")
async def login(request: Request):
    state = secrets.token_hex(16)
    sessions["oauth_state"] = state
    
    params = {
        "client_id": CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "response_type": "code",
        "scope": "openid profile email",
        "state": state,
    }
    
    query_string = "&".join(f"{k}={v}" for k, v in params.items())
    return RedirectResponse(f"{IDP_BASE_URL}/api/auth/authorize?{query_string}")


# 回调处理
@app.get("/auth/callback")
async def callback(code: str, state: str, error: str = None):
    if error:
        raise HTTPException(status_code=400, detail=error)
    
    if state != sessions.get("oauth_state"):
        raise HTTPException(status_code=400, detail="Invalid state")
    
    async with httpx.AsyncClient() as client:
        # 换取 Token
        token_response = await client.post(
            f"{IDP_BASE_URL}/api/auth/token",
            json={
                "grant_type": "authorization_code",
                "client_id": CLIENT_ID,
                "client_secret": CLIENT_SECRET,
                "code": code,
                "redirect_uri": REDIRECT_URI,
            },
        )
        
        if token_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Token exchange failed")
        
        token_data = token_response.json()
        
        # 获取用户信息
        user_response = await client.get(
            f"{IDP_BASE_URL}/api/auth/userinfo",
            headers={"Authorization": f"Bearer {token_data['access_token']}"},
        )
        
        user_info = user_response.json()
        
        sessions["user"] = {
            **user_info,
            "access_token": token_data["access_token"],
            "refresh_token": token_data["refresh_token"],
        }
        
    return {"message": "Login successful", "user": user_info}


# 获取当前用户
@app.get("/me")
async def get_me():
    if "user" not in sessions:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return sessions["user"]


# 登出
@app.post("/auth/logout")
async def logout():
    user = sessions.pop("user", None)
    if user:
        async with httpx.AsyncClient() as client:
            await client.post(
                f"{IDP_BASE_URL}/api/auth/revoke",
                json={"token": user["access_token"]},
            )
    return {"message": "Logged out"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

---

## 7. 第三方登录集成

### 7.1 GitHub 登录

**Step 1: 创建 GitHub OAuth App**

1. 访问 https://github.com/settings/developers
2. 点击 "New OAuth App"
3. 填写信息：
   - Application name: Your App Name
   - Homepage URL: https://your-app.com
   - Authorization callback URL: https://unionlogin.coze.site/api/auth/github/callback

**Step 2: 配置环境变量**

```env
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
```

**Step 3: 前端调用**

```html
<a href="https://unionlogin.coze.site/api/auth/github">使用 GitHub 登录</a>
```

### 7.2 Google 登录

**Step 1: 创建 Google OAuth App**

1. 访问 https://console.cloud.google.com/apis/credentials
2. 创建 OAuth 2.0 Client ID
3. 配置 Authorized redirect URI: https://unionlogin.coze.site/api/auth/google/callback

**Step 2: 配置环境变量**

```env
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

**Step 3: 前端调用**

```html
<a href="https://unionlogin.coze.site/api/auth/google">使用 Google 登录</a>
```

---

## 8. 常见问题

### Q1: 授权码过期了怎么办？

授权码有效期为 5 分钟。如果过期，用户需要重新发起授权流程。

### Q2: Refresh Token 过期了怎么办？

Refresh Token 有效期为 7 天。如果 Refresh Token 也过期了，用户需要重新登录。

### Q3: 如何处理跨域？

在业务应用后端进行 OAuth 回调处理，避免前端直接处理敏感信息。

### Q4: 如何实现强制登出？

调用 `/api/auth/revoke` 接口撤销 Token。

### Q5: 多租户模式下如何隔离用户？

- 在请求 Header 中添加 `X-Tenant-Id`
- 或在 URL 中添加 `tenantId` 参数
- 系统会根据租户 ID 自动隔离用户数据

### Q6: 如何获取 Client Secret？

创建应用时会返回 Client Secret。之后可以通过以下方式获取：
- 调用 `GET /api/apps/:clientId/secret` 接口
- 在管理后台点击"查看密钥"按钮

### Q7: 如何重新生成 Client Secret？

调用 `POST /api/apps/:clientId/regenerate-secret` 接口重新生成密钥。

---

## 附录

### A. 错误码对照表

| 错误码 | 说明 |
|--------|------|
| 400 | 请求参数错误 |
| 401 | 认证失败 |
| 403 | 权限不足 |
| 404 | 资源不存在 |
| 409 | 资源冲突（如用户名已存在） |
| 500 | 服务器内部错误 |

### B. OAuth 错误码

| 错误码 | 说明 |
|--------|------|
| invalid_request | 请求参数缺失或格式错误 |
| unauthorized_client | 应用未授权此授权类型 |
| access_denied | 用户拒绝授权 |
| invalid_grant | 授权码或 Refresh Token 无效 |
| invalid_client | 客户端认证失败 |

### C. 联系方式

如有问题，请联系系统管理员。
