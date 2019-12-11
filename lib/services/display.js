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

  /**
   * Format raw user data in secure way
   * @param {Object} user User object
   * @param {Object} tokens With access and refresh token
   * @returns {object} Secure object
   */
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

  /**
   * Format raw workspace data in secure way
   * @param {object} workspace Workspace object
   * @returns {object} Secure object
   */
  workspace(workspace) {
    /* TODO: Should be written */
    return workspace;
  }
};
