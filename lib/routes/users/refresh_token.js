'use strict';

const Helpers = require('../helpers');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');
const schemas = require('../../schemas');
const errorMessages = require('../../error_messages');
//const config = require('../../../config');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/refresh-token',
  options: {
    // plugins: {
    //   'hapi-rate-limit': {
    //     pathLimit: config.pathLimit
    //   }
    // },
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
      status: {
        200: schemas.authCredentials,
        401: schemas.boomError.description(`
          message = "${errorMessages.credentialsAreInvalid}"
            Credentials are not found or invalid
          message = "${errorMessages.refreshTokenExpired}"
            Refresh token is expired
        `),
        // 429: Joi.any().example(Boom.tooManyRequests('Rate limit exceeded')).description('Too Many Requests')
      }
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
        return Boom.unauthorized(errorMessages.credentialsAreInvalid);
      } else if (e.message === 'RefreshTokenExpired') {
        return Boom.unauthorized(errorMessages.refreshTokenExpired);
      }
      request.log(['debug-error'], 'Error on refresh token: ' + e);
      return Boom.internal();
    }
  }
});
