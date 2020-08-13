'use strict';

const config = require('../../../config');

module.exports = (server, options) => ({
  scheme: 'bell',
  options: {
    provider: 'facebook',
    password: config.credentials.cookiePassword,
    clientId: config.credentials.facebook.clientId,
    clientSecret: config.credentials.facebook.clientSecret,
    forceHttps: true,
    isSecure: true // TODO: change it when there will be a production server
  }
});
