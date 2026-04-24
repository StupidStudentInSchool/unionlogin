/**
 * Identity Center OAuth 2.0 客户端
 *
 * 完整实现 Authorization Code Flow
 */

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

class IdentityCenterClient {
  constructor(config) {
    this.config = {
      identityCenterUrl: config.IDENTITY_CENTER_URL || 'http://localhost:5000',
      clientId: config.CLIENT_ID,
      clientSecret: config.CLIENT_SECRET,
      redirectUri: config.REDIRECT_URI,
      scope: config.SCOPE || 'openid profile email',
    };

    // API 基础路径
    this.apiBase = this.config.identityCenterUrl;
  }

  /**
   * 生成授权 URL
   * @param {string} state - 随机状态参数（用于 CSRF 防护）
   * @returns {string} 授权 URL
   */
  getAuthorizationUrl(state = null) {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: this.config.scope,
      state: state || uuidv4(),
    });

    return `${this.apiBase}/api/oauth/authorize?${params.toString()}`;
  }

  /**
   * 交换授权码为 Token
   * @param {string} code - 授权码
   * @returns {Promise<Object>} Token 信息
   */
  async exchangeCodeForToken(code) {
    try {
      const response = await axios.post(`${this.apiBase}/api/oauth/token`, {
        grant_type: 'authorization_code',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code: code,
        redirect_uri: this.config.redirectUri,
      });

      return response.data;
    } catch (error) {
      console.error('Token 交换失败:', error.response?.data || error.message);
      throw new Error(`Token 交换失败: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * 刷新 Access Token
   * @param {string} refreshToken - 刷新令牌
   * @returns {Promise<Object>} 新的 Token 信息
   */
  async refreshToken(refreshToken) {
    try {
      const response = await axios.post(`${this.apiBase}/api/oauth/token`, {
        grant_type: 'refresh_token',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: refreshToken,
      });

      return response.data;
    } catch (error) {
      console.error('Token 刷新失败:', error.response?.data || error.message);
      throw new Error(`Token 刷新失败: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * 获取用户信息
   * @param {string} accessToken - Access Token
   * @returns {Promise<Object>} 用户信息
   */
  async getUserInfo(accessToken) {
    try {
      const response = await axios.get(`${this.apiBase}/api/oauth/userinfo`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return response.data;
    } catch (error) {
      console.error('获取用户信息失败:', error.response?.data || error.message);
      throw new Error(`获取用户信息失败: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * 验证 Token 有效性
   * @param {string} accessToken - Access Token
   * @returns {Promise<Object>} Token 信息
   */
  async introspectToken(accessToken) {
    try {
      const response = await axios.post(`${this.apiBase}/api/oauth/introspect`, {
        token: accessToken,
      });

      return response.data;
    } catch (error) {
      console.error('Token 验证失败:', error.response?.data || error.message);
      throw new Error(`Token 验证失败: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * 撤销 Token
   * @param {string} accessToken - Access Token
   * @returns {Promise<void>}
   */
  async revokeToken(accessToken) {
    try {
      await axios.post(`${this.apiBase}/api/oauth/revoke`, {
        token: accessToken,
      });
    } catch (error) {
      console.error('Token 撤销失败:', error.response?.data || error.message);
      throw new Error(`Token 撤销失败: ${error.response?.data?.message || error.message}`);
    }
  }
}

module.exports = IdentityCenterClient;
