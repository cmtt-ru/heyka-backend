require('dotenv').config()

module.exports = {
  port: process.env.PORT || 5000,
  credentials: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET
    }
  },
  redis: {
    uri: process.env.REDIS_URI || 'redis://127.0.0.1:6379'
  }
}
