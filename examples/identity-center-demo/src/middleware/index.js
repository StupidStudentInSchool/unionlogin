/**
 * 中间件导出
 */

const auth = require('./auth');

module.exports = {
  ...auth,
};
