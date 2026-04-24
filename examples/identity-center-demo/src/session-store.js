/**
 * 会话存储模块
 *
 * 管理用户登录状态和 Token
 * 生产环境建议使用 Redis 或数据库
 */

class SessionStore {
  constructor() {
    // 内存存储（生产环境请使用 Redis）
    this.sessions = new Map();
  }

  /**
   * 创建会话
   * @param {string} sessionId - 会话 ID
   * @param {Object} data - 会话数据
   */
  set(sessionId, data) {
    this.sessions.set(sessionId, {
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * 获取会话
   * @param {string} sessionId - 会话 ID
   * @returns {Object|null}
   */
  get(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * 更新会话
   * @param {string} sessionId - 会话 ID
   * @param {Object} data - 更新的数据
   */
  update(sessionId, data) {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.sessions.set(sessionId, {
        ...session,
        ...data,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  /**
   * 删除会话
   * @param {string} sessionId - 会话 ID
   */
  delete(sessionId) {
    this.sessions.delete(sessionId);
  }

  /**
   * 检查会话是否存在
   * @param {string} sessionId - 会话 ID
   * @returns {boolean}
   */
  has(sessionId) {
    return this.sessions.has(sessionId);
  }

  /**
   * 检查 Token 是否需要刷新（提前 5 分钟刷新）
   * @param {Object} session - 会话数据
   * @returns {boolean}
   */
  needsRefresh(session) {
    if (!session.expiresAt) return false;
    const expiresAt = new Date(session.expiresAt);
    const now = new Date();
    const fiveMinutes = 5 * 60 * 1000;
    return expiresAt.getTime() - now.getTime() < fiveMinutes;
  }
}

// 导出单例
const sessionStore = new SessionStore();
module.exports = sessionStore;
