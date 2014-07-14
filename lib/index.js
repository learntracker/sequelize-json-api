var Router  = require('./router')

module.exports = function(sequelize, options) {
  return new Router(sequelize, options);
}