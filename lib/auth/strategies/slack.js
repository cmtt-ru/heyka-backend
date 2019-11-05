'use strict';

const config = require('../../../config');

module.exports = (server, options) => ({
  scheme: 'bell',
  options: {
    provider: {
      protocol: 'oauth2',
      auth: 'https://slack.com/oauth/authorize',
      token: 'https://slack.com/api/oauth.access',
      scope: [
        'identity.basic',
        'identity.email',
        'identity.avatar'
      ],
      profile: async (credentials, params, get) => {
        credentials.params = params;
        return credentials;
      }
    },
    password: config.credentials.cookiePassword,
    clientId: config.credentials.slack.clientId,
    clientSecret: config.credentials.slack.clientSecret,
    isSecure: false, // TODO: change it when there will be a production server
    isSameSite: false
  },

});
