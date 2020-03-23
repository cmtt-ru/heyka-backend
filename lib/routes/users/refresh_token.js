'use strict';

const Helpers = require('../helpers');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');
const schemas = require('../../schemas');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/refresh-token',
  options: {
    auth: false,
    tags: ['api', 'auth'],
    description: 'Update client\'s refresh and access tokens',
    validate: {
      payload: Joi.object({
        accessToken: Joi.string().required(),
        refreshToken: Joi.string().required()
      }).label('RefreshTokenCredentials')
    },
    response: {
      failAction: 'error',
      schema: schemas.authCredentials
    }
  },
  handler: async (request, h) => {
    const { accessToken, refreshToken } = request.payload;
    const { userService } = request.services();
    
    try {
      const tokens = await userService.refreshToken(accessToken, refreshToken);

      return tokens;
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
