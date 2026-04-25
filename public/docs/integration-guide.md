# Identity Center 对接指南

## 目录

- [1. 系统概述](#1-系统概述)
- [2. 接入流程](#2-接入流程)
- [3. OAuth 2.0 授权码流程](#3-oauth-20-授权码流程)
- [4. API 接口说明](#4-api-接口说明)
- [5. 获取的用户信息](#5-获取的用户信息)
- [6. 接入示例代码](#6-接入示例代码)
- [7. Token 管理](#7-token-管理)
- [8. 安全建议](#8-安全建议)
- [9. 常见问题](#9-常见问题)

---

## 1. 系统概述

Identity Center 是一个基于 **OAuth 2.0 / OIDC 协议**的统一身份认证中心，为所有业务应用提供：

- **统一用户管理**：用户只需一个账号即可访问所有接入系统
- **单点登录 (SSO)**：一次登录，多处通行
- **多租户支持**：支持企业级多租户隔离
- **第三方登录**：支持 GitHub、Google、微信等第三方账号登录
- **权限管理**：统一的角色和权限控制

### 1.1 认证协议

本系统实现 **OAuth 2.0 Authorization Code Flow**，这是最安全、最推荐的 OAuth 2.0 授权模式：

```
┌─────────┐                              ┌─────────────┐
│  用户   │                              │   第三方    │
│ 浏览器  │                              │   应用      │
└────┬────┘                              └──────┬──────┘
     │                                          │
     │ 1. 用户点击"登录"                         │
     │ ──────────────────────────────────────>  │
     │                                          │
     │ 2. 重定向到认证中心授权页面               │
     │ <──────────────────────────────────────  │
     │                                          │
     │ 3. 用户登录并授权                        │
     │ ──────────────────────────────────────>  │
     │                                          │
     │ 4. 重定向回应用，携带授权码 (code)        │
     │ <──────────────────────────────────────  │
     │                                          │
     │                                          │ 5. 用授权码换取 Token
     │                                          │ ─────────────────────>
     │                                          │
     │                                          │ 6. 返回 Access Token
     │                                          │ <─────────────────────
     │                                          │
     │                                          │ 7. 获取用户信息
     │                                          │ ─────────────────────>
     │                                          │
     │ 8. 登录成功，显示用户信息                 │
     │ <──────────────────────────────────────  │
     │                                          │
```

---

## 2. 接入流程

### 步骤 1：注册应用

在 Identity Center 管理后台注册您的应用，获取以下凭证：

| 凭证 | 说明 | 示例 |
|------|------|------|
| `client_id` | 应用唯一标识（公开） | `46eb72e2551ae11605abe19e5c315cc7` |
| `client_secret` | 应用密钥（需妥善保管） | `a1b2c3d4e5f6...`（64位十六进制字符串） |
| `redirect_uris` | 授权回调地址 | `https://your-app.com/callback` |

**注册方式**：

1. 登录 Identity Center 管理后台
2. 进入"应用管理"页面
3. 点击"创建应用"按钮
4. 填写应用名称、回调地址等信息
5. 创建成功后，系统会弹出窗口显示 **Client ID** 和 **Client Secret**

**⚠️ 重要提示**：

> **Client Secret 在创建应用时自动生成并保存。** 您可以随时在管理后台查看：进入"应用管理" → 点击应用的"查看密钥"按钮即可获取。

**安全建议**：

- `client_id` 可以公开，用于标识您的应用
- `client_secret` 必须保密，不要提交到代码仓库、不要暴露在前端代码中
- 建议使用环境变量存储 `client_secret`：`IDC_CLIENT_SECRET=xxx`
- 回调地址必须与实际请求中的 `redirect_uri` 完全匹配（包括协议、域名、端口、路径）

### 步骤 2：配置应用

在您的应用中配置 Identity Center 的连接信息：

```javascript
// 配置信息
const IDENTITY_CENTER = {
  // 认证中心地址
  authorizeUrl: 'https://your-idc-domain/api/auth/authorize',
  tokenUrl: 'https://your-idc-domain/api/auth/token',
  userInfoUrl: 'https://your-idc-domain/api/auth/userinfo',
  
  // 应用凭证
  clientId: 'your_client_id',
  clientSecret: 'your_client_secret',
  redirectUri: 'https://your-app.com/callback',
};
```

### 步骤 3：实现登录流程

按照 OAuth 2.0 授权码流程实现登录逻辑（详见下文）。

---

## 3. OAuth 2.0 授权码流程

### 3.1 第一步：引导用户授权

将用户重定向到 Identity Center 的授权端点：

```
GET /api/auth/authorize?client_id={client_id}&redirect_uri={redirect_uri}&response_type=code&scope=openid profile email&state={state}
```

**参数说明**：

| 参数 | 必填 | 说明 |
|------|------|------|
| `client_id` | 是 | 应用唯一标识 |
| `redirect_uri` | 是 | 授权回调地址，必须与注册时一致 |
| `response_type` | 是 | 固定值 `code` |
| `scope` | 否 | 请求的权限范围，默认 `openid profile email` |
| `state` | 推荐 | 用于防止 CSRF 攻击的随机字符串 |

**示例**：

```html
<a href="https://idc.example.com/api/auth/authorize?client_id=46eb72e2551ae11605abe19e5c315cc7&redirect_uri=https%3A%2F%2Fapp.example.com%2Fcallback&response_type=code&scope=openid%20profile%20email&state=abc123">
  使用 Identity Center 登录
</a>
```

### 3.2 第二步：用户登录授权

用户在 Identity Center 页面完成登录和授权操作。如果用户已登录，可能直接完成授权。

### 3.3 第三步：接收授权码

用户授权后，Identity Center 会将用户重定向回您的 `redirect_uri`，并携带授权码：

```
GET https://your-app.com/callback?code={authorization_code}&state={state}
```

**验证 state**：
- 检查返回的 `state` 是否与您发送的 `state` 一致
- 不一致则拒绝请求，防止 CSRF 攻击

### 3.4 第四步：用授权码换取 Token

在您的后端服务中，使用授权码换取 Access Token：

```http
POST /api/auth/token
Content-Type: application/json

{
  "grant_type": "authorization_code",
  "client_id": "your_client_id",
  "client_secret": "your_client_secret",
  "code": "authorization_code",
  "redirect_uri": "https://your-app.com/callback"
}
```

**响应示例**：

```json
{
  "accessToken": "at_01b0df5d-850d-4637-a03f-4f262da208d1",
  "refreshToken": "rt_02c1eg6e-961e-5748-b14g-5g373eb319e2",
  "expiresIn": 3600,
  "tokenType": "Bearer"
}
```

### 3.5 第五步：获取用户信息

使用 Access Token 获取用户信息：

```http
GET /api/auth/userinfo
Authorization: Bearer {access_token}
```

**响应示例**：

```json
{
  "id": "2be9782d-c5a9-426f-a8b1-64cd622adcfa",
  "username": "admin",
  "email": "admin@example.com",
  "nickname": "管理员",
  "avatar": "https://example.com/avatar.jpg"
}
```

---

## 4. API 接口说明

### 4.1 认证相关接口

| 接口 | 方法 | 说明 | 认证 |
|------|------|------|------|
| `/api/auth/authorize` | GET | OAuth 授权入口 | 可选 |
| `/api/auth/token` | POST | 换取/刷新 Token | 否 |
| `/api/auth/userinfo` | GET | 获取用户信息 | 是 |
| `/api/auth/introspect` | POST | 验证 Token 有效性 | 否 |
| `/api/auth/revoke` | POST | 撤销 Token | 否 |
| `/api/auth/logout` | POST | 单点登出 | 是 |

### 4.2 接口详情

#### 4.2.1 换取 Access Token

```
POST /api/auth/token
Content-Type: application/json
```

**请求体（授权码模式）**：

```json
{
  "grant_type": "authorization_code",
  "client_id": "your_client_id",
  "client_secret": "your_client_secret",
  "code": "authorization_code",
  "redirect_uri": "https://your-app.com/callback"
}
```

**请求体（刷新 Token）**：

```json
{
  "grant_type": "refresh_token",
  "refresh_token": "your_refresh_token"
}
```

**响应**：

```json
{
  "accessToken": "at_xxx",
  "refreshToken": "rt_xxx",
  "expiresIn": 3600,
  "tokenType": "Bearer"
}
```

#### 4.2.2 获取用户信息

```
GET /api/auth/userinfo
Authorization: Bearer {access_token}
```

**响应**：

```json
{
  "id": "user_id",
  "username": "username",
  "email": "user@example.com",
  "nickname": "昵称",
  "avatar": "https://..."
}
```

#### 4.2.3 验证 Token 有效性

```
POST /api/auth/introspect
Content-Type: application/json

{
  "token": "access_token"
}
```

**响应（有效）**：

```json
{
  "active": true,
  "sub": "user_id",
  "exp": 1714032000
}
```

**响应（无效）**：

```json
{
  "active": false
}
```

#### 4.2.4 撤销 Token

```
POST /api/auth/revoke
Content-Type: application/json

{
  "token": "access_token"
}
```

**响应**：

```json
{
  "success": true
}
```

---

## 5. 获取的用户信息

### 5.1 基本信息

通过 `/api/auth/userinfo` 接口可获取以下用户基本信息：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 用户唯一标识（UUID） |
| `username` | string | 用户名 |
| `email` | string | 邮箱地址 |
| `nickname` | string | 昵称 |
| `avatar` | string | 头像 URL |

### 5.2 扩展信息

如需获取更详细的用户信息（如部门、角色等），可通过用户管理接口：

```
GET /api/users/profile
Authorization: Bearer {access_token}
```

**响应**：

```json
{
  "id": "user_id",
  "username": "username",
  "email": "user@example.com",
  "nickname": "昵称",
  "avatar": "https://...",
  "phone": "13800138000",
  "status": "active",
  "department": {
    "id": "dept_id",
    "name": "技术部",
    "path": "公司/研发中心/技术部"
  },
  "roles": ["admin", "developer"],
  "permissions": ["*"]
}
```

### 5.3 多租户信息

如果您的应用需要支持多租户，请在请求头中携带租户信息：

```http
GET /api/auth/userinfo
Authorization: Bearer {access_token}
X-Tenant-Id: {tenant_id}
```

---

## 6. 接入示例代码

### 6.1 Node.js / Express 示例

```javascript
// config.js
module.exports = {
  IDC_BASE_URL: 'https://idc.example.com',
  CLIENT_ID: 'your_client_id',
  CLIENT_SECRET: 'your_client_secret',
  REDIRECT_URI: 'https://your-app.com/callback',
};

// auth.js
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const config = require('./config');

const router = express.Router();

// 存储 state（生产环境应使用 Redis 等）
const stateStore = new Map();

// 登录入口
router.get('/login', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  stateStore.set(state, { createdAt: Date.now() });

  const authUrl = `${config.IDC_BASE_URL}/api/auth/authorize?` +
    `client_id=${config.CLIENT_ID}&` +
    `redirect_uri=${encodeURIComponent(config.REDIRECT_URI)}&` +
    `response_type=code&` +
    `scope=openid profile email&` +
    `state=${state}`;

  res.redirect(authUrl);
});

// OAuth 回调
router.get('/callback', async (req, res) => {
  const { code, state } = req.query;

  // 验证 state
  if (!stateStore.has(state)) {
    return res.status(400).send('Invalid state');
  }
  stateStore.delete(state);

  try {
    // 用授权码换取 Token
    const tokenResponse = await axios.post(`${config.IDC_BASE_URL}/api/auth/token`, {
      grant_type: 'authorization_code',
      client_id: config.CLIENT_ID,
      client_secret: config.CLIENT_SECRET,
      code,
      redirect_uri: config.REDIRECT_URI,
    });

    const { accessToken, refreshToken, expiresIn } = tokenResponse.data;

    // 获取用户信息
    const userResponse = await axios.get(`${config.IDC_BASE_URL}/api/auth/userinfo`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const user = userResponse.data;

    // 创建会话（设置 cookie 或 session）
    req.session.user = user;
    req.session.accessToken = accessToken;
    req.session.refreshToken = refreshToken;

    res.redirect('/dashboard');
  } catch (error) {
    console.error('OAuth error:', error.response?.data || error.message);
    res.status(500).send('Authentication failed');
  }
});

// 登出
router.post('/logout', async (req, res) => {
  try {
    // 撤销 Token
    await axios.post(`${config.IDC_BASE_URL}/api/auth/revoke`, {
      token: req.session.accessToken,
    });

    req.session.destroy();
    res.redirect('/');
  } catch (error) {
    res.status(500).send('Logout failed');
  }
});

module.exports = router;
```

### 6.2 React 前端示例

```jsx
// authService.js
const IDC_BASE_URL = 'https://idc.example.com';
const CLIENT_ID = 'your_client_id';
const REDIRECT_URI = 'https://your-app.com/callback';

export const authService = {
  // 发起登录
  login() {
    const state = Math.random().toString(36).substring(7);
    sessionStorage.setItem('oauth_state', state);

    const authUrl = `${IDC_BASE_URL}/api/auth/authorize?` +
      `client_id=${CLIENT_ID}&` +
      `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
      `response_type=code&` +
      `scope=openid profile email&` +
      `state=${state}`;

    window.location.href = authUrl;
  },

  // 处理回调（在 callback 页面调用）
  async handleCallback(code, state) {
    const savedState = sessionStorage.getItem('oauth_state');
    if (state !== savedState) {
      throw new Error('Invalid state');
    }
    sessionStorage.removeItem('oauth_state');

    // 调用后端接口完成 Token 交换
    const response = await fetch('/api/auth/callback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });

    if (!response.ok) {
      throw new Error('Authentication failed');
    }

    return response.json();
  },

  // 登出
  async logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  },
};
```

```jsx
// CallbackPage.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from './authService';

export function CallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');

    if (code && state) {
      authService.handleCallback(code, state)
        .then(() => navigate('/dashboard'))
        .catch(err => setError(err.message));
    } else {
      setError('Missing authorization code');
    }
  }, [navigate]);

  if (error) {
    return <div>登录失败: {error}</div>;
  }

  return <div>正在登录...</div>;
}
```

### 6.3 Python / Flask 示例

```python
# auth.py
import secrets
import requests
from flask import Blueprint, request, redirect, session, jsonify

auth_bp = Blueprint('auth', __name__)

IDC_BASE_URL = 'https://idc.example.com'
CLIENT_ID = 'your_client_id'
CLIENT_SECRET = 'your_client_secret'
REDIRECT_URI = 'https://your-app.com/callback'

@auth_bp.route('/login')
def login():
    state = secrets.token_hex(16)
    session['oauth_state'] = state
    
    auth_url = f"{IDC_BASE_URL}/api/auth/authorize?" + \
               f"client_id={CLIENT_ID}&" + \
               f"redirect_uri={REDIRECT_URI}&" + \
               f"response_type=code&" + \
               f"scope=openid profile email&" + \
               f"state={state}"
    
    return redirect(auth_url)

@auth_bp.route('/callback')
def callback():
    code = request.args.get('code')
    state = request.args.get('state')
    
    # 验证 state
    if state != session.get('oauth_state'):
        return 'Invalid state', 400
    
    session.pop('oauth_state', None)
    
    # 换取 Token
    token_response = requests.post(f"{IDC_BASE_URL}/api/auth/token", json={
        'grant_type': 'authorization_code',
        'client_id': CLIENT_ID,
        'client_secret': CLIENT_SECRET,
        'code': code,
        'redirect_uri': REDIRECT_URI,
    })
    
    if token_response.status_code != 200:
        return 'Token exchange failed', 400
    
    tokens = token_response.json()
    
    # 获取用户信息
    user_response = requests.get(
        f"{IDC_BASE_URL}/api/auth/userinfo",
        headers={'Authorization': f"Bearer {tokens['accessToken']}"}
    )
    
    user = user_response.json()
    
    # 存储会话
    session['user'] = user
    session['access_token'] = tokens['accessToken']
    session['refresh_token'] = tokens['refreshToken']
    
    return redirect('/dashboard')

@auth_bp.route('/logout', methods=['POST'])
def logout():
    access_token = session.get('access_token')
    
    if access_token:
        requests.post(f"{IDC_BASE_URL}/api/auth/revoke", json={
            'token': access_token
        })
    
    session.clear()
    return redirect('/')
```

---

## 7. Token 管理

### 7.1 Token 有效期

| Token 类型 | 有效期 | 说明 |
|------------|--------|------|
| Authorization Code | 5 分钟 | 一次性使用，用后即废 |
| Access Token | 1 小时 | 用于访问 API |
| Refresh Token | 7 天 | 用于刷新 Access Token |

### 7.2 刷新 Access Token

当 Access Token 过期时，使用 Refresh Token 获取新的 Access Token：

```http
POST /api/auth/token
Content-Type: application/json

{
  "grant_type": "refresh_token",
  "refresh_token": "your_refresh_token"
}
```

**响应**：

```json
{
  "accessToken": "at_new_token",
  "refreshToken": "rt_new_token",
  "expiresIn": 3600,
  "tokenType": "Bearer"
}
```

**注意**：刷新后会返回新的 Refresh Token，旧的 Refresh Token 失效。

### 7.3 Token 存储建议

| 环境 | 推荐存储方式 |
|------|-------------|
| 浏览器 SPA | 使用 `HttpOnly` Cookie 或 `sessionStorage` |
| 移动应用 | 使用系统安全存储（如 iOS Keychain、Android Keystore）|
| 服务端 | 使用 Redis 或数据库，关联用户会话 |

**安全建议**：
- 不要将 Token 存储在 `localStorage`（容易遭受 XSS 攻击）
- Access Token 可以存储在内存中
- Refresh Token 必须存储在安全位置

---

## 8. 安全建议

### 8.1 基本安全措施

1. **使用 HTTPS**：所有通信必须使用 HTTPS
2. **验证 state 参数**：防止 CSRF 攻击
3. **保护 client_secret**：不要在客户端暴露
4. **验证 redirect_uri**：必须与注册时完全一致
5. **短期有效的授权码**：授权码 5 分钟过期

### 8.2 PKCE 扩展（推荐）

对于公共客户端（如 SPA、移动应用），建议使用 PKCE (Proof Key for Code Exchange)：

```javascript
// 生成 code_verifier 和 code_challenge
function generatePKCE() {
  const codeVerifier = base64UrlEncode(crypto.randomBytes(32));
  const codeChallenge = base64UrlEncode(
    crypto.createHash('sha256').update(codeVerifier).digest()
  );
  return { codeVerifier, codeChallenge };
}

// 授权请求中添加 code_challenge
const authUrl = `${IDC_BASE_URL}/api/auth/authorize?` +
  `client_id=${CLIENT_ID}&` +
  `redirect_uri=${REDIRECT_URI}&` +
  `response_type=code&` +
  `code_challenge=${codeChallenge}&` +
  `code_challenge_method=S256&` +
  `state=${state}`;

// Token 请求中添加 code_verifier
const tokenResponse = await fetch(`${IDC_BASE_URL}/api/auth/token`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    grant_type: 'authorization_code',
    client_id: CLIENT_ID,
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: codeVerifier,
  }),
});
```

### 8.3 单点登出

当用户在您的应用中登出时，建议同时登出 Identity Center：

```javascript
async function logout() {
  // 1. 撤销本地 Token
  await fetch('/api/auth/logout', { method: 'POST' });
  
  // 2. 重定向到 Identity Center 登出页面
  window.location.href = `${IDC_BASE_URL}/login.html?logout=true`;
}
```

---

## 9. 常见问题

### Q1: 授权码只能使用一次吗？

是的，授权码使用后会立即失效。如果重复使用，会返回错误。

### Q2: Access Token 过期后怎么办？

使用 Refresh Token 刷新获取新的 Access Token。如果 Refresh Token 也过期了，需要用户重新登录。

### Q3: 如何实现"记住我"功能？

在初始授权时请求更长的 Refresh Token 有效期，或使用 Refresh Token 自动刷新会话。

### Q4: 多个应用之间如何实现单点登录？

用户在第一个应用登录后，Identity Center 会保持登录状态。当用户访问第二个应用时，直接完成授权，无需再次输入密码。

### Q5: 如何处理用户取消授权？

用户取消授权时，会重定向回您的应用，URL 中会包含 `error=access_denied` 参数：

```
https://your-app.com/callback?error=access_denied&state=xxx
```

### Q6: 支持哪些第三方登录？

目前支持：
- GitHub
- Google
- 微信（需配置企业微信应用）

### Q7: 如何获取用户的角色和权限？

使用 `/api/users/profile` 接口可以获取用户的角色和权限信息。您可以根据这些信息控制应用内的功能访问。

### Q8: API 返回 401 错误怎么办？

检查：
1. Access Token 是否正确传递（`Authorization: Bearer {token}`）
2. Access Token 是否已过期
3. Access Token 是否已被撤销

---

## 联系支持

如有问题，请联系：

- **技术支持邮箱**：support@example.com
- **API 文档**：https://your-idc-domain/api/docs
- **问题反馈**：https://github.com/your-org/identity-center/issues
