const config = require('./index.js')

module.exports = {
  server: {
    port: config.port
  },
  register: {
    plugins: [
      './modules/auth',
      './modules/api',
      {
        plugin: 'hapi-redis2',
        options: {
          settings: config.redis.uri,
          decorate: true
        }
      }
    ]
  }
}
