# Identity Center OAuth 2.0 接入示例

基于 OAuth 2.0 Authorization Code Flow 的完整接入示例。

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 填入你的 Client ID 和 Secret

# 3. 启动服务
npm start
```

访问 http://localhost:3001 开始测试。

## 目录结构

```
src/
├── app.js                      # Express 应用入口
├── identity-center-client.js   # OAuth 客户端封装
├── session-store.js            # 会话存储
└── middleware/
    └── auth.js                 # 认证中间件
```

## 文档

- [完整接入指南](./INTEGRATION_GUIDE.md) - 详细的接入流程和 API 参考
- [快速接入模板](./INTEGRATION_TEMPLATE.md) - 可直接复制给 AI 使用的模板

## 流程概览

```
用户访问 → 重定向到 Identity Center → 用户登录授权
    ↓
回调到应用 → 用 code 换 Token → 获取用户信息 → 完成登录
```

## API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/login` | GET | 发起 OAuth 授权 |
| `/callback` | GET | OAuth 回调处理 |
| `/logout` | GET | 退出登录 |
| `/dashboard` | GET | 仪表盘（需登录） |
| `/api/userinfo` | GET | 获取用户信息 |
| `/api/refresh` | POST | 刷新 Token |
| `/api/public-data` | GET | 公开数据 |

## 配置说明

编辑 `.env` 文件：

```env
IDENTITY_CENTER_URL=http://localhost:5000
CLIENT_ID=your_client_id
CLIENT_SECRET=your_client_secret
REDIRECT_URI=http://localhost:3001/callback
SCOPE=openid profile email
SESSION_SECRET=your_session_secret
PORT=3001
```

## 获取帮助

- 详细文档: [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md)
- 快速模板: [INTEGRATION_TEMPLATE.md](./INTEGRATION_TEMPLATE.md)
