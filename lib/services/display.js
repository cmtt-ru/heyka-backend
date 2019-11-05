'use strict';

const Schmervice = require('schmervice');

module.exports = class DisplayService extends Schmervice.Service {
  constructor(...args) {
    super(...args);
  }

  user (user, tokens) {
    const secureUserInfo = {
      ...user,
      accessToken: tokens.access,
      refreshToken: tokens.refresh
    };
    delete user.password;
    return secureUserInfo;
  }
};
