# Identity Center OAuth 2.0 接入指南

## 目录

- [概述](#概述)
- [接入流程图](#接入流程图)
- [前置准备](#前置准备)
- [快速开始](#快速开始)
- [OAuth 2.0 Authorization Code Flow](#oauth-20-authorization-code-flow)
- [API 参考](#api-参考)
- [常见问题](#常见问题)
- [安全建议](#安全建议)

---

## 概述

本文档描述了如何将第三方应用接入 Identity Center 统一身份认证系统。

Identity Center 基于 **OAuth 2.0 Authorization Code Flow** 实现单点登录（SSO），支持：
- 用户身份认证
- 第三方应用授权
- 多租户隔离
- 标准化的用户信息获取

---

## 接入流程图

```
┌─────────────┐                              ┌──────────────────┐
│   用户      │                              │   Identity       │
│   浏览器    │                              │   Center         │
└──────┬──────┘                              └────────┬─────────┘
       │                                              │
       │  1. 访问应用                                  │
       │  ──────────────────────────────────────────►│
       │                                              │
       │  2. 未登录，重定向到登录                     │
       │  ◄──────────────────────────────────────────│
       │                                              │
       │  3. 用户登录/授权                            │
       │  ──────────────────────────────────────────►│
       │                                              │
       │  4. 返回授权码 (code)                        │
       │  ◄──────────────────────────────────────────│
       │                                              │
       │  5. 用 code 换 token                         │
       │  ──────────────────────────────────────────►│
       │                                              │
       │  6. 返回 access_token + refresh_token        │
       │  ◄──────────────────────────────────────────│
       │                                              │
       │  7. 用 access_token 获取用户信息             │
       │  ──────────────────────────────────────────►│
       │                                              │
       │  8. 返回用户信息                             │
       │  ◄──────────────────────────────────────────│
       │                                              │
       │  9. 登录成功，进入应用                       │
       │  ◄──────────────────────────────────────────│
       │                                              │
```

---

## 前置准备

### 1. 在 Identity Center 管理后台注册应用

1. 登录 Identity Center 管理后台
2. 进入「应用管理」→「创建应用」
3. 填写以下信息：
   - **应用名称**: 你的应用名称（如「统一支付系统」）
   - **回调地址**: 你的应用接收授权码的地址
   - **授权类型**: Authorization Code
   - **权限范围**: openid profile email

4. 获取以下配置信息：
   - **Client ID**: 应用标识
   - **Client Secret**: 应用密钥（请妥善保管！）

### 2. 环境要求

- Node.js >= 16.0.0
- HTTPS（生产环境必须）

---

## 快速开始

### 1. 克隆示例项目

```bash
git clone <repository-url>
cd identity-center-demo
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# Identity Center 服务地址
IDENTITY_CENTER_URL=https://your-identity-center.com

# 从管理后台获取
CLIENT_ID=your_client_id
CLIENT_SECRET=your_client_secret

# 你的应用回调地址（必须与注册的一致）
REDIRECT_URI=https://your-app.com/callback

# 请求的权限范围
SCOPE=openid profile email

# 会话密钥
SESSION_SECRET=generate_a_random_string

# 应用端口
PORT=3001
```

### 4. 启动服务

```bash
# 开发环境
npm run dev

# 生产环境
npm start
```

### 5. 测试接入

1. 访问 http://localhost:3001/
2. 点击「登录」按钮
3. 在 Identity Center 完成登录授权
4. 授权后自动跳回应用，进入仪表盘

---

## OAuth 2.0 Authorization Code Flow

### 完整流程

```
1. 引导用户到授权页面
      ↓
2. 用户在 Identity Center 登录并授权
      ↓
3. 回调到你的应用，带上授权码 (code)
      ↓
4. 用授权码换取 Token
      ↓
5. 用 Token 获取用户信息
      ↓
6. 完成登录
```

### 详细实现

#### Step 1: 生成授权 URL

```javascript
const params = new URLSearchParams({
  client_id: 'your_client_id',
  redirect_uri: 'https://your-app.com/callback',
  response_type: 'code',
  scope: 'openid profile email',
  state: generateRandomState(), // CSRF 防护
});

const authUrl = `https://identity-center.com/api/oauth/authorize?${params.toString()}`;
```

**参数说明：**

| 参数 | 必填 | 说明 |
|------|------|------|
| client_id | 是 | 应用的 Client ID |
| redirect_uri | 是 | 回调地址，必须与注册时一致 |
| response_type | 是 | 固定值 `code` |
| scope | 是 | 权限范围，用空格分隔 |
| state | 建议 | 随机字符串，用于 CSRF 防护 |

#### Step 2: 处理回调

用户授权后，Identity Center 会重定向到你的回调地址：

```
https://your-app.com/callback?code=xxx&state=yyy
```

```javascript
app.get('/callback', async (req, res) => {
  const { code, state } = req.query;

  // 1. 验证 state（CSRF 防护）
  if (state !== savedState) {
    return res.status(400).send('State 验证失败');
  }

  // 2. 用授权码换取 Token
  const tokenResponse = await fetch('https://identity-center.com/api/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: 'your_client_id',
      client_secret: 'your_client_secret',
      code: code,
      redirect_uri: 'https://your-app.com/callback',
    }),
  });

  const tokenData = await tokenResponse.json();
  // {
  //   access_token: "at_xxx",
  //   refresh_token: "rt_xxx",
  //   token_type: "Bearer",
  //   expires_in: 3600
  // }

  // 3. 用 Token 获取用户信息
  const userResponse = await fetch('https://identity-center.com/api/oauth/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  const userInfo = await userResponse.json();
  // {
  //   sub: "user_id",
  //   username: "john",
  //   email: "john@example.com",
  //   name: "John Doe"
  // }

  // 4. 完成登录（创建本地会话）
  req.session.user = userInfo;
  req.session.accessToken = tokenData.access_token;
  req.session.refreshToken = tokenData.refresh_token;

  res.redirect('/dashboard');
});
```

#### Step 3: Token 刷新

Access Token 有效期为 1 小时，需要使用 Refresh Token 刷新：

```javascript
async function refreshAccessToken(refreshToken) {
  const response = await fetch('https://identity-center.com/api/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: 'your_client_id',
      client_secret: 'your_client_secret',
      refresh_token: refreshToken,
    }),
  });

  return await response.json();
}
```

---

## API 参考

### 1. 授权接口

**授权跳转 URL**

```
GET /api/oauth/authorize
```

| 参数 | 说明 |
|------|------|
| client_id | Client ID |
| redirect_uri | 回调地址 |
| response_type | 固定 `code` |
| scope | 权限范围 |
| state | CSRF 防护随机字符串 |

### 2. Token 接口

**换取 Token**

```
POST /api/oauth/token
Content-Type: application/json

{
  "grant_type": "authorization_code",
  "client_id": "xxx",
  "client_secret": "xxx",
  "code": "xxx",
  "redirect_uri": "xxx"
}
```

**响应**

```json
{
  "access_token": "at_xxx",
  "refresh_token": "rt_xxx",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

**刷新 Token**

```json
{
  "grant_type": "refresh_token",
  "client_id": "xxx",
  "client_secret": "xxx",
  "refresh_token": "rt_xxx"
}
```

### 3. 用户信息接口

**获取用户信息**

```
GET /api/oauth/userinfo
Authorization: Bearer <access_token>
```

**响应**

```json
{
  "sub": "user_123",
  "username": "john",
  "email": "john@example.com",
  "name": "John Doe"
}
```

### 4. Token 验证接口

**验证 Token**

```
POST /api/oauth/introspect
Content-Type: application/json

{
  "token": "<access_token>"
}
```

**响应**

```json
{
  "active": true,
  "sub": "user_123",
  "client_id": "xxx",
  "scope": "openid profile email",
  "exp": 1234567890
}
```

### 5. Token 撤销接口

**撤销 Token**

```
POST /api/oauth/revoke
Content-Type: application/json

{
  "token": "<access_token>"
}
```

---

## 常见问题

### Q: 回调地址需要 HTTPS 吗？

**生产环境**：必须使用 HTTPS
**开发环境**：可以使用 HTTP

### Q: 授权码有效期多久？

授权码有效期为 **5 分钟**，且只能使用一次。

### Q: Token 有效期是多久？

- Access Token: 1 小时
- Refresh Token: 7 天

### Q: 如何处理 Token 过期？

使用 Refresh Token 换取新的 Access Token，参考 [Token 刷新](#step-3-token-刷新)

### Q: 如何支持多租户？

在请求中通过 `X-Tenant-Id` Header 或 URL 参数传递租户标识：

```
GET /api/oauth/userinfo
X-Tenant-Id: tenant_xxx
```

### Q: 回调地址需要与注册时完全一致吗？

是的，回调地址必须与在 Identity Center 注册时填写的地址完全一致，包括协议（http/https）、域名、端口和路径。

---

## 安全建议

### 1. 保护 Client Secret

```javascript
// ❌ 错误：暴露在客户端代码中
const clientSecret = 'xxx';

// ✅ 正确：使用环境变量
const clientSecret = process.env.CLIENT_SECRET;
```

### 2. 使用 HTTPS

生产环境必须使用 HTTPS，确保 Token 在传输过程中加密。

### 3. CSRF 防护

始终验证 `state` 参数，防止跨站请求伪造：

```javascript
app.get('/callback', (req, res) => {
  const { state } = req.query;

  // 验证 state 是否匹配
  if (state !== sessionStore.get(req.sessionId).oauthState) {
    return res.status(400).send('Invalid state');
  }

  // 继续处理...
});
```

### 4. Token 安全存储

- 不要将 Token 存储在 localStorage（容易受到 XSS 攻击）
- 使用 HttpOnly Cookie 或安全的会话存储
- 生产环境建议使用加密的 Cookie 或 Redis

### 5. 最小权限原则

只请求必要的权限范围：

```javascript
// ✅ 推荐：按需请求
scope: 'openid email'

// ❌ 不推荐：请求所有权限
scope: 'openid profile email phone address *'
```

---

## 示例代码结构

```
identity-center-demo/
├── package.json
├── .env.example
├── .env
├── .gitignore
└── src/
    ├── app.js                      # Express 应用入口
    ├── identity-center-client.js   # OAuth 客户端封装
    ├── session-store.js            # 会话存储
    └── middleware/
        ├── auth.js                 # 认证中间件
        └── index.js
```

---

## 技术支持

如有问题，请联系：
- 邮箱: support@example.com
- 文档: https://docs.identity-center.com
