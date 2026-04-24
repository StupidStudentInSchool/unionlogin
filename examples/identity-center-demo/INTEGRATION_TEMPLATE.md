# Identity Center 接入模板

> 复制此模板给你的 AI 助手，让它帮助你快速接入 Identity Center

---

## 一、系统信息

**Identity Center 地址**: `http://localhost:5000`

## 二、OAuth 2.0 接入配置

### 应用配置（从管理后台获取）

```json
{
  "client_id": "c35aeca737a543e16bc5fb16bc6a4e2d",
  "redirect_uri": "https://your-app.com/callback",
  "scope": "openid profile email"
}
```

### 回调地址

```
https://your-app.com/callback
```

## 三、接入步骤

### Step 1: 引导用户到授权页面

```
GET {IDENTITY_CENTER_URL}/api/oauth/authorize
```

参数：
- `client_id` - 应用的 Client ID
- `redirect_uri` - 回调地址
- `response_type` - 固定为 `code`
- `scope` - 权限范围（openid profile email）
- `state` - 随机字符串（CSRF 防护）

### Step 2: 接收授权回调

用户授权后，会重定向到：

```
{redirect_uri}?code=授权码&state=原state
```

### Step 3: 用授权码换取 Token

```javascript
POST {IDENTITY_CENTER_URL}/api/oauth/token
Content-Type: application/json

{
  "grant_type": "authorization_code",
  "client_id": "{client_id}",
  "client_secret": "{client_secret}",
  "code": "{授权码}",
  "redirect_uri": "{redirect_uri}"
}
```

响应：
```json
{
  "access_token": "at_xxx",
  "refresh_token": "rt_xxx",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

### Step 4: 获取用户信息

```javascript
GET {IDENTITY_CENTER_URL}/api/oauth/userinfo
Authorization: Bearer {access_token}
```

响应：
```json
{
  "sub": "用户ID",
  "username": "用户名",
  "email": "邮箱",
  "name": "姓名"
}
```

### Step 5: Token 刷新（可选）

```javascript
POST {IDENTITY_CENTER_URL}/api/oauth/token
Content-Type: application/json

{
  "grant_type": "refresh_token",
  "client_id": "{client_id}",
  "client_secret": "{client_secret}",
  "refresh_token": "{refresh_token}"
}
```

## 四、完整示例代码

### Node.js/Express

```javascript
const express = require('express');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const app = express();

// 配置
const CONFIG = {
  IDENTITY_CENTER_URL: 'http://localhost:5000',
  CLIENT_ID: 'your_client_id',
  CLIENT_SECRET: 'your_client_secret',
  REDIRECT_URI: 'http://localhost:3000/callback',
  SCOPE: 'openid profile email'
};

// 登录入口
app.get('/login', (req, res) => {
  const state = uuidv4();
  const authUrl = `${CONFIG.IDENTITY_CENTER_URL}/api/oauth/authorize?` +
    `client_id=${CONFIG.CLIENT_ID}&` +
    `redirect_uri=${encodeURIComponent(CONFIG.REDIRECT_URI)}&` +
    `response_type=code&` +
    `scope=${CONFIG.SCOPE}&` +
    `state=${state}`;

  res.redirect(authUrl);
});

// 回调处理
app.get('/callback', async (req, res) => {
  const { code, state } = req.query;

  try {
    // 1. 换取 Token
    const tokenRes = await axios.post(`${CONFIG.IDENTITY_CENTER_URL}/api/oauth/token`, {
      grant_type: 'authorization_code',
      client_id: CONFIG.CLIENT_ID,
      client_secret: CONFIG.CLIENT_SECRET,
      code,
      redirect_uri: CONFIG.REDIRECT_URI
    });

    const { access_token, refresh_token } = tokenRes.data;

    // 2. 获取用户信息
    const userRes = await axios.get(`${CONFIG.IDENTITY_CENTER_URL}/api/oauth/userinfo`, {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    // 3. 创建本地会话
    req.session.user = userRes.data;
    req.session.accessToken = access_token;
    req.session.refreshToken = refresh_token;

    res.redirect('/dashboard');
  } catch (error) {
    console.error('登录失败:', error.message);
    res.status(500).send('登录失败');
  }
});

// Token 刷新
app.post('/api/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.session;

    const tokenRes = await axios.post(`${CONFIG.IDENTITY_CENTER_URL}/api/oauth/token`, {
      grant_type: 'refresh_token',
      client_id: CONFIG.CLIENT_ID,
      client_secret: CONFIG.CLIENT_SECRET,
      refresh_token
    });

    req.session.accessToken = tokenRes.data.access_token;
    req.session.refreshToken = tokenRes.data.refresh_token;

    res.json({ success: true });
  } catch (error) {
    res.status(401).json({ success: false, error: error.message });
  }
});

app.listen(3000, () => {
  console.log('应用已启动: http://localhost:3000');
});
```

### Python/Flask

```python
import requests
import uuid
from flask import Flask, redirect, request, session

app = Flask(__name__)
app.secret_key = 'your-secret-key'

CONFIG = {
    'IDENTITY_CENTER_URL': 'http://localhost:5000',
    'CLIENT_ID': 'your_client_id',
    'CLIENT_SECRET': 'your_client_secret',
    'REDIRECT_URI': 'http://localhost:5000/callback',
    'SCOPE': 'openid profile email'
}

@app.route('/login')
def login():
    state = str(uuid.uuid4())
    auth_url = f"{CONFIG['IDENTITY_CENTER_URL']}/api/oauth/authorize?" \
               f"client_id={CONFIG['CLIENT_ID']}&" \
               f"redirect_uri={CONFIG['REDIRECT_URI']}&" \
               f"response_type=code&" \
               f"scope={CONFIG['SCOPE']}&" \
               f"state={state}"

    session['oauth_state'] = state
    return redirect(auth_url)

@app.route('/callback')
def callback():
    code = request.args.get('code')
    state = request.args.get('state')

    # 换取 Token
    token_resp = requests.post(f"{CONFIG['IDENTITY_CENTER_URL']}/api/oauth/token", json={
        'grant_type': 'authorization_code',
        'client_id': CONFIG['CLIENT_ID'],
        'client_secret': CONFIG['CLIENT_SECRET'],
        'code': code,
        'redirect_uri': CONFIG['REDIRECT_URI']
    })

    token_data = token_resp.json()
    session['access_token'] = token_data['access_token']
    session['refresh_token'] = token_data['refresh_token']

    # 获取用户信息
    user_resp = requests.get(
        f"{CONFIG['IDENTITY_CENTER_URL']}/api/oauth/userinfo",
        headers={'Authorization': f"Bearer {session['access_token']}"}
    )

    session['user'] = user_resp.json()
    return redirect('/dashboard')

if __name__ == '__main__':
    app.run(port=5000)
```

### 前端 JavaScript (SPA)

```javascript
const CONFIG = {
  IDENTITY_CENTER_URL: 'http://localhost:5000',
  CLIENT_ID: 'your_client_id',
  REDIRECT_URI: 'http://localhost:3000/callback',
  SCOPE: 'openid profile email'
};

// 登录
function login() {
  const state = crypto.randomUUID();
  sessionStorage.setItem('oauth_state', state);

  const authUrl = `${CONFIG.IDENTITY_CENTER_URL}/api/oauth/authorize?` +
    `client_id=${CONFIG.CLIENT_ID}&` +
    `redirect_uri=${encodeURIComponent(CONFIG.REDIRECT_URI)}&` +
    `response_type=code&` +
    `scope=${CONFIG.SCOPE}&` +
    `state=${state}`;

  window.location.href = authUrl;
}

// 回调处理（从 URL 获取 code）
async function handleCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');

  // 验证 state
  if (state !== sessionStorage.getItem('oauth_state')) {
    throw new Error('State 不匹配');
  }

  // 调用后端接口换取 Token
  const response = await fetch('/api/auth/callback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code })
  });

  const data = await response.json();
  localStorage.setItem('access_token', data.access_token);
  localStorage.setItem('refresh_token', data.refresh_token);

  // 清除 URL 中的 code
  window.history.replaceState({}, '', '/');
}
```

## 五、错误处理

### 常见错误码

| 错误码 | 说明 | 处理方式 |
|--------|------|----------|
| `invalid_request` | 请求参数错误 | 检查参数是否完整正确 |
| `invalid_client` | Client ID 或 Secret 错误 | 检查配置 |
| `invalid_grant` | 授权码无效或已过期 | 重新发起授权 |
| `unauthorized_client` | 应用未授权 | 检查应用状态 |
| `unsupported_grant_type` | 不支持的授权类型 | 检查 grant_type |

### 错误响应格式

```json
{
  "error": "error_code",
  "error_description": "错误描述"
}
```

## 六、注意事项

1. **回调地址必须与注册时一致**，包括协议、域名、端口
2. **Client Secret 必须保密**，不要暴露在前端代码中
3. **state 参数用于 CSRF 防护**，必须验证
4. **Token 要安全存储**，建议使用 HttpOnly Cookie
5. **生产环境必须使用 HTTPS**

---

## 七、测试清单

- [ ] 回调地址配置正确
- [ ] 可以跳转到授权页面
- [ ] 授权后正确回调
- [ ] Token 交换成功
- [ ] 可以获取用户信息
- [ ] Token 刷新功能正常
- [ ] 退出登录功能正常
- [ ] 错误处理完善
