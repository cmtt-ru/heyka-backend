'use strict';

const Helpers = require('../helpers');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/refresh_token',
  options: {
    auth: false,
    validate: {
      payload: {
        accessToken: Joi.string().guid().required(),
        refreshToken: Joi.string().guid().required()
      }
    }
  },
  handler: async (request, h) => {
    const { accessToken, refreshToken } = request.payload;
    const { userService } = request.services();
    
    try {
      const tokens = await userService.refreshToken(accessToken, refreshToken);

      return {
        accessToken: tokens.access,
        refreshToken: tokens.refresh
      };
    } catch (e) {
      if (e.message === 'RefreshTokenNotFound' || e.message === 'AccessTokenNotMatched') {
        return Boom.unauthorized('Credentials are invalid');
      } else if (e.message === 'RefreshTokenExpired') {
        return Boom.unauthorized('Refresh token is expired');
      }
      request.log(['debug-error'], 'Error on sign up user: ' + e);
      return Boom.internal();
    }
  }
});
