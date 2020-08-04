'use strict';

const config = require('../../../config');

module.exports = (server, options) => ({
  scheme: 'bell',
  options: {
    provider: 'google',
    password: config.credentials.cookiePassword,
    clientId: config.credentials.google.clientId,
    clientSecret: config.credentials.google.clientSecret,
    isSecure: true // TODO: change it when there will be a production server
  }
});
