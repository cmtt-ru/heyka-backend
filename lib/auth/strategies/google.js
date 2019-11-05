'use strict';

const config = require('../../../config');

module.exports = (server, options) => ({
  scheme: 'bell',
  options: {
    provider: 'google',
    password: 'secret password should be 32 chars long, that is the reason why that string is too long',
    clientId: config.credentials.google.clientId,
    clientSecret: config.credentials.google.clientSecret,
    isSecure: false
  }
});
