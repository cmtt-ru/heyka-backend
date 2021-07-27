'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const Joi = require('@hapi/joi');
const schemas = require('../../schemas');
const errorMessages = require('../../error_messages');
//const config = require('../../../config');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/signin/link/{fullCode}',
  options: {
    // plugins: {
    //   'hapi-rate-limit': {
    //     pathLimit: config.pathLimit
    //   }
    // },
    auth: false,
    tags: ['api', 'auth'],
    description: 'Creates credential tokens by authorization link',
    validate: {
      params: Joi.object({
        fullCode: Joi.string().required().length(82).regex(/^[0-9a-f]{82}$/i)
      })
    },
    response: {
      status: {
        200: schemas.authCredentials,
        400: Joi.any().example(Boom.badRequest(errorMessages.authLinkInvalid).output.payload)
          .description('Auth link is not found, is expired or has been disactivated'),
      // 429: Joi.any().example(Boom.tooManyRequests('Rate limit exceeded')).description('Too Many Requests')
      },
      failAction: 'error',
    }
  },
  handler: async (request, h) => {
    const { userService } = request.services();
    const { fullCode } = request.params;
    
    try {
      const {
        isValid,
        user
      } = await userService.checkAuthLink(fullCode);

      if (!isValid) {
        return Boom.badRequest(errorMessages.authLinkInvalid);
      }

      const tokens = await userService.createTokens(user);

      return tokens;
    } catch (e) {
      request.log(['debug-error'], 'Error on authorization by link: ' + e);
      return Boom.internal();
    }
  }
});
