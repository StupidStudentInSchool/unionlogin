# 统一身份认证中心 - 对接手册

## 目录

1. [系统概述](#1-系统概述)
2. [快速开始](#2-快速开始)
3. [OAuth 2.0 对接](#3-oauth-20-对接)
4. [API 接口参考](#4-api-接口参考)
5. [SDK 对接示例](#5-sdk-对接示例)
6. [第三方登录集成](#6-第三方登录集成)
7. [常见问题](#7-常见问题)

---

## 1. 系统概述

### 1.1 什么是统一身份认证中心

统一身份认证中心（Identity Center）是一个集中管理用户身份和权限的系统，为所有业务应用提供：
- **统一用户管理**：注册、登录、个人信息管理
- **单点登录（SSO）**：一次登录，全站通行
- **OAuth 2.0 / OIDC 支持**：标准协议对接
- **第三方登录**：GitHub、Google、微信
- **多租户支持**：支持多个组织隔离

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

---

## 2. 快速开始

### 2.1 环境要求

- Node.js >= 18
- MySQL >= 8.0
- Redis >= 6.0

### 2.2 配置步骤

**Step 1: 配置环境变量**

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=your_password
DB_NAME=identity_center

# Redis 配置
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT 配置（生产环境请修改）
JWT_SECRET=your-super-secret-key-change-in-production

# 应用配置
APP_PORT=5000
FRONTEND_URL=http://localhost:3000
```

**Step 2: 初始化数据库**

```bash
# 创建数据库
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS identity_center CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 初始化数据
pnpm ts-node src/database/init.ts
```

**Step 3: 启动服务**

```bash
# 开发模式
pnpm start:dev

# 生产模式
pnpm build
pnpm start:prod
```

**Step 4: 访问文档**

```
http://localhost:5000/api/docs
```

### 2.3 默认账户

| 账户 | 用户名 | 密码 |
|------|--------|------|
| 管理员 | admin | admin123 |

---

## 3. OAuth 2.0 对接

### 3.1 对接流程

```
1. 用户访问应用 → 应用重定向到 IdP 授权页面
2. 用户在 IdP 登录并授权
3. IdP 返回授权码 (Authorization Code)
4. 应用使用授权码换取 Access Token
5. 应用使用 Access Token 调用用户信息 API
6. 应用创建本地会话
```

### 3.2 注册应用

在管理员后台或调用 API 创建应用：

```bash
POST /api/apps
{
  "name": "My Application",
  "description": "My awesome app",
  "redirectUris": ["http://localhost:3000/callback"],
  "allowedScopes": ["openid", "profile", "email"]
}
```

返回：
```json
{
  "id": "uuid-xxx",
  "clientId": "app_xxxxxxxxxxxx",
  "clientSecret": "xxxxxxxxxx",  // 仅创建时返回，请妥善保管
  "name": "My Application",
  "redirectUris": ["http://localhost:3000/callback"],
  "allowedScopes": ["openid", "profile", "email"],
  "status": 1
}
```

### 3.3 授权码模式对接

#### Step 1: 构建授权 URL

```
GET {IDP_BASE_URL}/api/auth/authorize
```

参数：

| 参数 | 必填 | 说明 |
|------|------|------|
| clientId | 是 | 应用的 Client ID |
| redirectUri | 是 | 授权成功后的回调地址 |
| responseType | 是 | 固定为 `code` |
| scope | 否 | 权限范围，默认 `openid profile email` |
| state | 推荐 | CSRF 防护随机字符串 |

示例：
```
http://localhost:5000/api/auth/authorize?clientId=app_xxxxxxxxxxxx&redirectUri=http://localhost:3000/callback&responseType=code&scope=openid%20profile%20email&state=random_string_xyz
```

#### Step 2: 处理回调

用户在 IdP 登录授权后，会重定向到你的回调地址：

```
http://localhost:3000/callback?code=auth_code_xxx&state=random_string_xyz
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
POST {IDP_BASE_URL}/api/auth/token
Content-Type: application/json

{
  "grantType": "authorization_code",
  "clientId": "app_xxxxxxxxxxxx",
  "clientSecret": "your_client_secret",
  "code": "auth_code_xxx",
  "redirectUri": "http://localhost:3000/callback"
}
```

响应：
```json
{
  "accessToken": "at_xxxxx",
  "tokenType": "Bearer",
  "expiresIn": 3600,
  "refreshToken": "rt_xxxxx",
  "scope": "openid profile email"
}
```

#### Step 4: 获取用户信息

```bash
GET {IDP_BASE_URL}/api/auth/userinfo
Authorization: Bearer at_xxxxx
```

响应：
```json
{
  "sub": "user-uuid-xxx",
  "username": "zhangsan",
  "email": "zhangsan@example.com",
  "emailVerified": true,
  "nickname": "张三",
  "picture": "https://example.com/avatar.jpg",
  "updatedAt": 1704067200
}
```

### 3.4 Token 刷新

当 Access Token 过期时，使用 Refresh Token 获取新的 Access Token：

```bash
POST {IDP_BASE_URL}/api/auth/token
Content-Type: application/json

{
  "grantType": "refresh_token",
  "clientId": "app_xxxxxxxxxxxx",
  "clientSecret": "your_client_secret",
  "refreshToken": "rt_xxxxx"
}
```

### 3.5 Token 验证

业务应用可以验证 Token 的有效性：

```bash
POST {IDP_BASE_URL}/api/auth/introspect
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

---

## 4. API 接口参考

### 4.1 用户管理

| 接口 | 方法 | 说明 | 认证 |
|------|------|------|------|
| `/api/users/register` | POST | 用户注册 | 否 |
| `/api/users/login` | POST | 用户登录 | 否 |
| `/api/users/me` | GET | 获取当前用户 | Bearer Token |
| `/api/users/me` | PUT | 更新个人信息 | Bearer Token |
| `/api/users/password` | PUT | 修改密码 | Bearer Token |
| `/api/users/sessions` | GET | 获取登录设备 | Bearer Token |

### 4.2 OAuth 2.0

| 接口 | 方法 | 说明 | 认证 |
|------|------|------|------|
| `/api/auth/authorize` | GET/POST | 授权页面 | 可选 |
| `/api/auth/token` | POST | 获取 Token | Client Secret |
| `/api/auth/userinfo` | GET | 获取用户信息 | Bearer Token |
| `/api/auth/introspect` | POST | 验证 Token | 否 |
| `/api/auth/revoke` | POST | 撤销 Token | 否 |
| `/api/auth/logout` | GET | 单点登出 | Bearer Token |

### 4.3 应用管理

| 接口 | 方法 | 说明 | 认证 |
|------|------|------|------|
| `/api/apps` | GET | 应用列表 | Bearer Token |
| `/api/apps` | POST | 创建应用 | Bearer Token |
| `/api/apps/:id` | GET | 应用详情 | Bearer Token |
| `/api/apps/:id` | PUT | 更新应用 | Bearer Token |
| `/api/apps/:id` | DELETE | 删除应用 | Bearer Token |

### 4.4 审计日志

| 接口 | 方法 | 说明 | 认证 |
|------|------|------|------|
| `/api/audit/logs` | GET | 查询审计日志 | Bearer Token |

### 4.5 第三方登录

| 接口 | 方法 | 说明 | 认证 |
|------|------|------|------|
| `/api/auth/github` | GET | GitHub 登录入口 | 否 |
| `/api/auth/github/callback` | GET | GitHub 回调 | 否 |
| `/api/auth/google` | GET | Google 登录入口 | 否 |
| `/api/auth/google/callback` | GET | Google 回调 | 否 |
| `/api/auth/wechat` | GET | 微信登录入口 | 否 |
| `/api/auth/wechat/callback` | GET | 微信回调 | 否 |

---

## 5. SDK 对接示例

### 5.1 前端 JavaScript 对接

```javascript
// identity-sdk.js
class IdentityCenter {
  constructor(options) {
    this.baseUrl = options.baseUrl;
    this.clientId = options.clientId;
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
      clientId: this.clientId,
      redirectUri: this.redirectUri,
      responseType: 'code',
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
        grantType: 'authorization_code',
        clientId: this.clientId,
        clientSecret: this.clientSecret,
        code,
        redirectUri: this.redirectUri,
      }),
    });
    
    const data = await response.json();
    
    // 保存 Token
    localStorage.setItem('access_token', data.accessToken);
    localStorage.setItem('refresh_token', data.refreshToken);
    
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
        grantType: 'refresh_token',
        clientId: this.clientId,
        clientSecret: this.clientSecret,
        refreshToken,
      }),
    });
    
    const data = await response.json();
    localStorage.setItem('access_token', data.accessToken);
    localStorage.setItem('refresh_token', data.refreshToken);
    
    return data;
  }

  // 检查登录状态
  isAuthenticated() {
    return !!localStorage.getItem('access_token');
  }

  // 登出
  logout() {
    const token = localStorage.getItem('access_token');
    if (token) {
      fetch(`${this.baseUrl}/api/auth/logout`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
    }
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }
}

// 使用示例
const identity = new IdentityCenter({
  baseUrl: 'http://localhost:5000',
  clientId: 'your_client_id',
  redirectUri: 'http://localhost:3000/callback',
});

// 登录
identity.login();

// 回调处理（在 callback 页面调用）
const user = await identity.handleCallback();
console.log(user);

// 获取用户信息
const userInfo = await identity.getUserInfo();
console.log(userInfo);

// 检查登录状态
if (identity.isAuthenticated()) {
  // 已登录
}

// 登出
identity.logout();
```

### 5.2 Node.js 后端对接

```javascript
// server.js
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const session = require('express-session');

const app = express();

const IDP_BASE_URL = 'http://localhost:5000';
const CLIENT_ID = 'your_client_id';
const CLIENT_SECRET = 'your_client_secret';
const REDIRECT_URI = 'http://localhost:3000/auth/callback';

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
    clientId: CLIENT_ID,
    redirectUri: REDIRECT_URI,
    responseType: 'code',
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
      grantType: 'authorization_code',
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      code,
      redirectUri: REDIRECT_URI,
    });
    
    const { accessToken, refreshToken } = tokenResponse.data.data;
    
    // 获取用户信息
    const userResponse = await axios.get(`${IDP_BASE_URL}/api/auth/userinfo`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    
    const user = userResponse.data.data;
    
    // 创建本地会话
    req.session.user = {
      id: user.sub,
      username: user.username,
      email: user.email,
      accessToken,
      refreshToken,
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
app.get('/auth/logout', (req, res) => {
  if (req.session.user?.accessToken) {
    axios.post(`${IDP_BASE_URL}/api/auth/revoke`, {
      token: req.session.user.accessToken,
    }).catch(console.error);
  }
  req.session.destroy();
  res.redirect('/');
});

app.listen(3000, () => {
  console.log('App running on http://localhost:3000');
});
```

### 5.3 Python (FastAPI) 对接

```python
# main.py
from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
import httpx
import secrets
import asyncio

app = FastAPI()

IDP_BASE_URL = "http://localhost:5000"
CLIENT_ID = "your_client_id"
CLIENT_SECRET = "your_client_secret"
REDIRECT_URI = "http://localhost:8000/auth/callback"

sessions = {}


class TokenData(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    expires_in: int


# 登录入口
@app.get("/auth/login")
async def login():
    state = secrets.token_hex(16)
    sessions["oauth_state"] = state
    
    params = {
        "clientId": CLIENT_ID,
        "redirectUri": REDIRECT_URI,
        "responseType": "code",
        "scope": "openid profile email",
        "state": state,
    }
    
    auth_url = f"{IDP_BASE_URL}/api/auth/authorize"
    return RedirectResponse(f"{auth_url}?{'&'.join(f'{k}={v}' for k, v in params.items())}")


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
                "grantType": "authorization_code",
                "clientId": CLIENT_ID,
                "clientSecret": CLIENT_SECRET,
                "code": code,
                "redirectUri": REDIRECT_URI,
            },
        )
        
        if token_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Token exchange failed")
        
        token_data = token_response.json()["data"]
        
        # 获取用户信息
        user_response = await client.get(
            f"{IDP_BASE_URL}/api/auth/userinfo",
            headers={"Authorization": f"Bearer {token_data['access_token']}"},
        )
        
        user_info = user_response.json()["data"]
        
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
@app.get("/auth/logout")
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

## 6. 第三方登录集成

### 6.1 GitHub 登录

**Step 1: 创建 GitHub OAuth App**

1. 访问 https://github.com/settings/developers
2. 点击 "New OAuth App"
3. 填写信息：
   - Application name: Your App Name
   - Homepage URL: http://localhost:3000
   - Authorization callback URL: http://localhost:5000/api/auth/github/callback

**Step 2: 配置环境变量**

```env
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_CALLBACK_URL=http://localhost:5000/api/auth/github/callback
```

**Step 3: 前端调用**

```html
<a href="http://localhost:5000/api/auth/github">使用 GitHub 登录</a>
```

### 6.2 Google 登录

**Step 1: 创建 Google OAuth App**

1. 访问 https://console.cloud.google.com/apis/credentials
2. 创建 OAuth 2.0 Client ID
3. 配置Authorized redirect URI: http://localhost:5000/api/auth/google/callback

**Step 2: 配置环境变量**

```env
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
```

**Step 3: 前端调用**

```html
<a href="http://localhost:5000/api/auth/google">使用 Google 登录</a>
```

### 6.3 微信登录

**Step 1: 申请微信开放平台账号**

1. 访问 https://open.weixin.qq.com
2. 创建网站应用并获取 AppID 和 AppSecret

**Step 2: 配置环境变量**

```env
WECHAT_APP_ID=your_wechat_app_id
WECHAT_APP_SECRET=your_wechat_app_secret
WECHAT_CALLBACK_URL=http://localhost:5000/api/auth/wechat/callback
```

**Step 3: 前端调用**

```html
<a href="http://localhost:5000/api/auth/wechat">使用微信登录</a>
```

---

## 7. 常见问题

### Q1: 授权码过期了怎么办？

授权码有效期为 5 分钟。如果过期，用户需要重新发起授权流程。

### Q2: Refresh Token 过期了怎么办？

Refresh Token 有效期为 7 天。如果 Refresh Token 也过期了，用户需要重新登录。

### Q3: 如何处理跨域？

在业务应用后端进行 OAuth 回调处理，避免前端直接处理敏感信息。

### Q4: 如何实现强制登出？

1. 调用 `/api/users/sessions` 获取所有会话
2. 调用 `/api/users/sessions/:sessionId` 删除指定会话

### Q5: 多租户模式下如何隔离用户？

- 在请求 Header 中添加 `X-Tenant-Id` 或在 URL 中添加 `tenantId` 参数
- 系统会根据租户 ID 自动隔离用户数据

### Q6: 如何扩展第三方登录？

参考 `src/modules/third-party/third-party.service.ts`，实现对应的 OAuth 流程即可。

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
