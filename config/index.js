'use strict';

require('dotenv').config();

module.exports = {
  port: process.env.PORT || 5000,
  host: process.env.HOST || 'localhost',
  credentials: {
    cookiePassword: process.env.COOKIE_PASSWORD,
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || 'google-client-id',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'google-client-secret'
    },
    slack: {
      clientId: process.env.SLACK_CLIENT_ID || 'slack-client-id',
      clientSecret: process.env.SLACK_CLIENT_SECRET || 'slack-client-secret',
      verificationToken: process.env.SLACK_VERIFICATION_TOKEN || 'slack-verification-token'
    },
    facebook: {
      clientId: process.env.FACEBOOK_CLIENT_ID || 'facebook-client-id',
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET || 'facebook-client-secret'
    },
    mailgun: {
      domain: process.env.MAILGUN_DOMAIN,
      apikey: process.env.MAILGUN_APIKEY
    }
  },
  redis: {
    uri: process.env.REDIS_URI || 'redis://127.0.0.1:6379'
  },
  pg: {
    uri: process.env.DATABASE_URL || 'postgres://pg:strongpassword@localhost:5432/heyka'
  }
};
