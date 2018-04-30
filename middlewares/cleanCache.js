const { clearHash } = require('../services/cache');

module.exports = async (req, res, next) => {
  await next(); // wait for the excecution of route

  clearHash(req.user.id);
}
