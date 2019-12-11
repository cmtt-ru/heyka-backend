'use strict';

require('dotenv').config();

module.exports = {
  port: process.env.PORT || 5000,
  credentials: {
    cookiePassword: process.env.COOKIE_PASSWORD,
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET
    },
    slack: {
      clientId: process.env.SLACK_CLIENT_ID,
      clientSecret: process.env.SLACK_CLIENT_SECRET,
      verificationToken: process.env.SLACK_VERIFICATION_TOKEN
    }
  },
  redis: {
    uri: process.env.REDIS_URI || 'redis://127.0.0.1:6379'
  },
  pg: {
    uri: process.env.DATABASE_URL || 'postgres://pg:strongpassword@localhost:5432/heyka'
  }
};
