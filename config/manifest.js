const config = require('./index.js')

module.exports = {
  server: {
    port: config.port
  },
  register: {
    plugins: [
      './modules/api'
    ]
  }
}
