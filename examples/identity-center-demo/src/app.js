/**
 * Identity Center 接入示例 - Express 应用
 *
 * 完整演示 OAuth 2.0 Authorization Code Flow
 */

require('dotenv').config();

const express = require('express');
const cookieParser = require('cookie-parser');
const { v4: uuidv4 } = require('uuid');

const IdentityCenterClient = require('./identity-center-client');
const sessionStore = require('./session-store');
const { requireAuth, requireApiToken } = require('./middleware');

const app = express();

// 初始化 Identity Center 客户端
const identityClient = new IdentityCenterClient({
  IDENTITY_CENTER_URL: process.env.IDENTITY_CENTER_URL,
  CLIENT_ID: process.env.CLIENT_ID,
  CLIENT_SECRET: process.env.CLIENT_SECRET,
  REDIRECT_URI: process.env.REDIRECT_URI,
  SCOPE: process.env.SCOPE,
});

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// 生成会话 ID 中间件
app.use((req, res, next) => {
  if (!req.cookies.sessionId) {
    const sessionId = uuidv4();
    res.cookie('sessionId', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 天
    });
    req.sessionId = sessionId;
  } else {
    req.sessionId = req.cookies.sessionId;
  }
  next();
});

// ============================================
// 路由
// ============================================

/**
 * 首页
 */
app.get('/', (req, res) => {
  const session = sessionStore.get(req.sessionId);

  const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>统一支付系统 - Identity Center 接入示例</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      background: white;
      border-radius: 20px;
      padding: 40px;
      max-width: 500px;
      width: 90%;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    h1 { color: #333; margin-bottom: 10px; }
    .subtitle { color: #666; margin-bottom: 30px; }
    .info { background: #f5f5f5; padding: 20px; border-radius: 10px; margin-bottom: 20px; }
    .info h3 { color: #333; margin-bottom: 10px; }
    .info p { color: #666; margin: 5px 0; font-size: 14px; }
    .btn {
      display: inline-block;
      padding: 12px 30px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      transition: all 0.3s;
      margin: 5px;
    }
    .btn-primary {
      background: #667eea;
      color: white;
    }
    .btn-primary:hover { background: #5568d3; }
    .btn-secondary {
      background: #f5f5f5;
      color: #333;
    }
    .btn-secondary:hover { background: #e5e5e5; }
    .btn-danger {
      background: #dc3545;
      color: white;
    }
    .btn-danger:hover { background: #c82333; }
    .user-info {
      background: #e8f5e9;
      padding: 20px;
      border-radius: 10px;
      margin-bottom: 20px;
    }
    .user-info h3 { color: #2e7d32; margin-bottom: 10px; }
    .user-info p { color: #333; margin: 8px 0; }
    .user-info strong { display: inline-block; width: 80px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>统一支付系统</h1>
    <p class="subtitle">Identity Center OAuth 2.0 接入示例</p>

    ${
      session?.userInfo
        ? `
    <div class="user-info">
      <h3>已登录用户</h3>
      <p><strong>用户ID:</strong> ${session.userInfo.sub || session.userInfo.id}</p>
      <p><strong>用户名:</strong> ${session.userInfo.username || session.userInfo.name}</p>
      <p><strong>邮箱:</strong> ${session.userInfo.email || '-'}</p>
      <p><strong>登录时间:</strong> ${session.createdAt}</p>
    </div>
    <div style="text-align: center;">
      <a href="/dashboard" class="btn btn-primary">进入仪表盘</a>
      <a href="/logout" class="btn btn-danger">退出登录</a>
    </div>
    `
        : `
    <div class="info">
      <h3>当前状态</h3>
      <p>您尚未登录，请先通过 Identity Center 授权登录</p>
    </div>
    <div style="text-align: center;">
      <a href="/login" class="btn btn-primary">登录</a>
      <a href="/api/public-data" class="btn btn-secondary">查看公开数据</a>
    </div>
    `
    }
  </div>
</body>
</html>
  `;

  res.send(html);
});

/**
 * 登录页面 - 发起授权
 */
app.get('/login', (req, res) => {
  // 生成 state 用于 CSRF 防护
  const state = uuidv4();

  // 保存 state 到会话
  sessionStore.set(`oauth_state_${state}`, {
    sessionId: req.sessionId,
    createdAt: new Date().toISOString(),
  });

  // 构建授权 URL
  const authUrl = identityClient.getAuthorizationUrl(state);

  console.log(`[Login] 重定向到: ${authUrl}`);
  res.redirect(authUrl);
});

/**
 * OAuth 回调处理
 * Identity Center 会将用户重定向到此地址
 */
app.get('/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;

  // 处理错误情况
  if (error) {
    console.error(`[Callback] OAuth 错误: ${error} - ${error_description}`);
    return res.send(`
      <html>
        <body>
          <h2>授权失败</h2>
          <p>错误: ${error}</p>
          <p>描述: ${error_description}</p>
          <a href="/">返回首页</a>
        </body>
      </html>
    `);
  }

  // 验证 state（CSRF 防护）
  const savedState = sessionStore.get(`oauth_state_${state}`);
  if (!savedState) {
    console.error('[Callback] State 验证失败或已过期');
    return res.status(400).send('State 验证失败');
  }

  // 删除已使用的 state
  sessionStore.delete(`oauth_state_${state}`);

  try {
    console.log('[Callback] 交换授权码:', code);

    // 交换授权码为 Token
    const tokenData = await identityClient.exchangeCodeForToken(code);
    console.log('[Callback] Token 交换成功:', tokenData);

    // 获取用户信息
    const userInfo = await identityClient.getUserInfo(tokenData.access_token);
    console.log('[Callback] 获取用户信息成功:', userInfo);

    // 保存会话
    sessionStore.set(req.sessionId, {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
      userInfo: userInfo,
    });

    console.log('[Callback] 会话保存成功');

    // 重定向到首页
    res.redirect('/');
  } catch (error) {
    console.error('[Callback] 处理失败:', error.message);
    res.status(500).send(`处理失败: ${error.message}`);
  }
});

/**
 * 退出登录
 */
app.get('/logout', async (req, res) => {
  const session = sessionStore.get(req.sessionId);

  if (session?.accessToken) {
    try {
      // 撤销 Token
      await identityClient.revokeToken(session.accessToken);
      console.log('[Logout] Token 已撤销');
    } catch (error) {
      console.error('[Logout] Token 撤销失败:', error.message);
    }
  }

  // 删除会话
  sessionStore.delete(req.sessionId);

  // 清除 Cookie
  res.clearCookie('sessionId');

  res.send(`
    <html>
      <body>
        <h2>已退出登录</h2>
        <p>正在返回...</p>
        <script>
          setTimeout(() => window.location.href = '/', 1500);
        </script>
      </body>
    </html>
  `);
});

/**
 * 仪表盘（需要登录）
 */
app.get('/dashboard', requireAuth, async (req, res) => {
  const session = req.session;

  // 检查是否需要刷新 Token
  if (req.needsRefresh && session.refreshToken) {
    try {
      console.log('[Dashboard] Token 即将过期，刷新中...');
      const newToken = await identityClient.refreshToken(session.refreshToken);

      sessionStore.update(req.sessionId, {
        accessToken: newToken.access_token,
        refreshToken: newToken.refresh_token,
        expiresAt: new Date(Date.now() + newToken.expires_in * 1000).toISOString(),
      });

      session = sessionStore.get(req.sessionId);
      console.log('[Dashboard] Token 刷新成功');
    } catch (error) {
      console.error('[Dashboard] Token 刷新失败:', error.message);
      // Token 刷新失败，跳转到登录
      return res.redirect('/login');
    }
  }

  // 获取最新用户信息
  let userInfo = session.userInfo;
  try {
    userInfo = await identityClient.getUserInfo(session.accessToken);
    sessionStore.update(req.sessionId, { userInfo });
  } catch (error) {
    console.error('[Dashboard] 获取用户信息失败:', error.message);
  }

  const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>仪表盘 - 统一支付系统</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      min-height: 100vh;
    }
    .header {
      background: white;
      padding: 20px 40px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .header h1 { color: #667eea; }
    .header a { color: #666; text-decoration: none; margin-left: 20px; }
    .container { max-width: 1200px; margin: 40px auto; padding: 0 20px; }
    .card {
      background: white;
      border-radius: 10px;
      padding: 30px;
      margin-bottom: 20px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.05);
    }
    .card h2 { color: #333; margin-bottom: 20px; border-bottom: 2px solid #667eea; padding-bottom: 10px; }
    .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; }
    .info-item { padding: 15px; background: #f9f9f9; border-radius: 8px; }
    .info-item label { display: block; color: #666; font-size: 12px; margin-bottom: 5px; }
    .info-item value { color: #333; font-size: 16px; font-weight: 500; word-break: break-all; }
    .btn {
      display: inline-block;
      padding: 10px 20px;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 500;
      transition: all 0.3s;
    }
    .btn-primary { background: #667eea; color: white; }
    .btn-primary:hover { background: #5568d3; }
    .btn-secondary { background: #f5f5f5; color: #333; }
    .btn-secondary:hover { background: #e5e5e5; }
    .token-display {
      background: #f5f5f5;
      padding: 15px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 12px;
      word-break: break-all;
      max-height: 100px;
      overflow-y: auto;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>仪表盘</h1>
    <div>
      <a href="/">首页</a>
      <a href="/logout">退出登录</a>
    </div>
  </div>

  <div class="container">
    <div class="card">
      <h2>用户信息</h2>
      <div class="info-grid">
        <div class="info-item">
          <label>用户 ID</label>
          <value>${userInfo.sub || userInfo.id || '-'}</value>
        </div>
        <div class="info-item">
          <label>用户名</label>
          <value>${userInfo.username || userInfo.name || '-'}</value>
        </div>
        <div class="info-item">
          <label>邮箱</label>
          <value>${userInfo.email || '-'}</value>
        </div>
        <div class="info-item">
          <label>Token 过期时间</label>
          <value>${new Date(session.expiresAt).toLocaleString()}</value>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>Token 信息</h2>
      <p style="color: #666; margin-bottom: 15px;">
        <strong>Access Token:</strong> (已隐藏，请在控制台查看)
      </p>
      <div class="token-display" id="token-display">
        点击下方按钮显示 Token
      </div>
      <div style="margin-top: 15px;">
        <button onclick="showToken()" class="btn btn-secondary">显示 Access Token</button>
        <button onclick="refreshToken()" class="btn btn-primary">刷新 Token</button>
      </div>
    </div>

    <div class="card">
      <h2>API 测试</h2>
      <p style="color: #666; margin-bottom: 15px;">测试调用受保护的 API 接口</p>
      <button onclick="testApi()" class="btn btn-primary">测试 API 调用</button>
      <pre id="api-result" style="margin-top: 15px; padding: 15px; background: #f5f5f5; border-radius: 8px; overflow-x: auto;"></pre>
    </div>
  </div>

  <script>
    const accessToken = '${session.accessToken}';

    function showToken() {
      document.getElementById('token-display').textContent = accessToken;
    }

    async function refreshToken() {
      try {
        const response = await fetch('/api/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: '${session.refreshToken}' })
        });
        const data = await response.json();
        document.getElementById('token-display').textContent = 'Token 已刷新！请刷新页面查看新 Token';
        alert('Token 刷新成功');
      } catch (error) {
        alert('Token 刷新失败: ' + error.message);
      }
    }

    async function testApi() {
      try {
        const response = await fetch('/api/userinfo', {
          headers: { Authorization: 'Bearer ' + accessToken }
        });
        const data = await response.json();
        document.getElementById('api-result').textContent = JSON.stringify(data, null, 2);
      } catch (error) {
        document.getElementById('api-result').textContent = 'API 调用失败: ' + error.message;
      }
    }
  </script>
</body>
</html>
  `;

  res.send(html);
});

// ============================================
// API 路由
// ============================================

/**
 * 获取用户信息 API
 */
app.get('/api/userinfo', requireApiToken, async (req, res) => {
  try {
    const userInfo = await identityClient.getUserInfo(req.session.accessToken);
    res.json({
      success: true,
      data: userInfo,
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * 刷新 Token API
 */
app.post('/api/refresh', async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({
      success: false,
      error: '缺少 refreshToken',
    });
  }

  try {
    const tokenData = await identityClient.refreshToken(refreshToken);

    // 更新会话
    sessionStore.update(req.sessionId, {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
    });

    res.json({
      success: true,
      data: {
        expiresIn: tokenData.expires_in,
      },
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * 公开数据 API（无需登录）
 */
app.get('/api/public-data', (req, res) => {
  res.json({
    success: true,
    data: {
      message: '这是公开数据，无需登录即可访问',
      timestamp: new Date().toISOString(),
      features: [
        '用户登录/注册',
        '用户信息管理',
        'OAuth 2.0 授权',
        '多租户支持',
      ],
    },
  });
});

/**
 * 登录检查 API
 */
app.get('/api/check-auth', (req, res) => {
  const session = sessionStore.get(req.sessionId);

  if (session?.userInfo) {
    res.json({
      success: true,
      authenticated: true,
      user: session.userInfo,
    });
  } else {
    res.json({
      success: true,
      authenticated: false,
    });
  }
});

// ============================================
// 启动服务器
// ============================================

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log('Identity Center 接入示例已启动');
  console.log('='.repeat(50));
  console.log(`本地地址: http://localhost:${PORT}`);
  console.log(`回调地址: ${process.env.REDIRECT_URI}`);
  console.log('');
  console.log('访问以下地址开始测试:');
  console.log(`  1. 首页:     http://localhost:${PORT}/`);
  console.log(`  2. 登录:     http://localhost:${PORT}/login`);
  console.log(`  3. 仪表盘:   http://localhost:${PORT}/dashboard`);
  console.log(`  4. 公开 API: http://localhost:${PORT}/api/public-data`);
  console.log('');
  console.log(`Identity Center 地址: ${process.env.IDENTITY_CENTER_URL}`);
  console.log('='.repeat(50));
});

module.exports = app;
