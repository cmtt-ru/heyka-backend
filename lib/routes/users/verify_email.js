'use strict';

const Helpers = require('../helpers');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');
const errorMessages = require('../../error_messages');
const schemas = require('../../schemas');
//const config = require('../../../config');

module.exports = Helpers.withDefaults({
  method: 'GET',
  path: '/verify/{token}',
  options: {
    // plugins: {
    //   'hapi-rate-limit': {
    //     pathLimit: config.pathLimit
    //   }
    // },
    auth: false,
    tags: ['api', 'auth'],
    description: 'Verify email address by verification token',
    validate: {
      params: Joi.object({
        token: Joi.string().required(),
      })
    },
    response: {
      status: {
        200: schemas.authedUser,
        400: Joi.any().example(Boom.badRequest(errorMessages.verificationCodeIsNotValid).output.payload)
          .description('Verification token is not valid'),
        // 429: Joi.any().example(Boom.tooManyRequests('Rate limit exceeded')).description('Too Many Requests')
      }
    }
  },
  handler: async (request, h) => {
    const { userService, displayService } = request.services();
    const { token } = request.params;
    
    try {
      const user = await userService.verifyEmailAddress(token);
      const tokens = await userService.createTokens(user);

      return {
        user: displayService.userWithConfidentialData(user),
        credentials: tokens
      };
    } catch (e) {
      switch (e.message) {
      case 'NotFound':
      case 'UserNotFound':
      case 'VerificationCodesNotMatched':
      case 'EmailNotMatched':
      case 'VerificationCodeExpired':
      case 'TokenIsInvalid':
        return Boom.badRequest(errorMessages.verificationCodeIsNotValid);
      default:
        request.log(['debug-error'], 'Error on email verification: ' + e);
        return Boom.internal();
      }
    }
  }
});
