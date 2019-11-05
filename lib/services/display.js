'use strict';

const Schmervice = require('schmervice');
const SECURE_KEYS = [
  'password',
  'googleToken', 'googleTokenExpiresIn', 'googleId',
  'slackToken', 'slackAccessToken', 'slackTokenExpiresIn', 'slackId'
];

module.exports = class DisplayService extends Schmervice.Service {
  constructor(...args) {
    super(...args);
  }

  user (user, tokens) {
    const secureUserInfo = {
      ...user,
      accessToken: tokens.access,
      refreshToken: tokens.refresh,
    };
    SECURE_KEYS.forEach(key => {
      delete secureUserInfo[key];
    });
    return secureUserInfo;
  }
};
