require('dotenv').config()

module.exports = {
  port: process.env.PORT || 5000,
  credentials: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET
    }
  }
}
