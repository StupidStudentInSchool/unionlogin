/**
 * 认证中间件
 *
 * 检查用户是否已登录
 */

const sessionStore = require('../session-store');

/**
 * 要求登录中间件
 * 如果用户未登录，重定向到登录页面
 */
function requireAuth(req, res, next) {
  const sessionId = req.headers['x-session-id'] || req.cookies?.sessionId;

  if (!sessionId || !sessionStore.has(sessionId)) {
    // 未登录，重定向到 Identity Center
    const identityCenterUrl = process.env.IDENTITY_CENTER_URL;
    const clientId = process.env.CLIENT_ID;
    const redirectUri = encodeURIComponent(process.env.REDIRECT_URI);
    const scope = process.env.SCOPE || 'openid profile email';

    // 生成随机 state
    const state = require('uuid').v4();

    // 保存 state 到 session（用于 CSRF 防护）
    sessionStore.set(`oauth_state_${state}`, { createdAt: new Date().toISOString() });

    const authUrl = `${identityCenterUrl}/api/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}`;

    return res.redirect(authUrl);
  }

  // 检查 Token 是否需要刷新
  const session = sessionStore.get(sessionId);
  if (sessionStore.needsRefresh(session)) {
    // Token 即将过期，标记需要刷新
    req.needsRefresh = true;
  }

  req.session = session;
  next();
}

/**
 * 可选登录中间件
 * 如果用户已登录，附加用户信息到请求
 */
function optionalAuth(req, res, next) {
  const sessionId = req.headers['x-session-id'] || req.cookies?.sessionId;

  if (sessionId && sessionStore.has(sessionId)) {
    req.session = sessionStore.get(sessionId);
  }

  next();
}

/**
 * 检查 API Token 中间件
 * 用于保护 API 路由
 */
function requireApiToken(req, res, next) {
  const sessionId = req.headers['x-session-id'] || req.cookies?.sessionId;

  if (!sessionId || !sessionStore.has(sessionId)) {
    return res.status(401).json({
      error: 'unauthorized',
      message: '请先登录',
    });
  }

  const session = sessionStore.get(sessionId);
  if (!session.accessToken) {
    return res.status(401).json({
      error: 'invalid_token',
      message: 'Token 无效',
    });
  }

  req.session = session;
  next();
}

module.exports = {
  requireAuth,
  optionalAuth,
  requireApiToken,
};
