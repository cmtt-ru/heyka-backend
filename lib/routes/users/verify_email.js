'use strict';

const Helpers = require('../helpers');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');
const errorMessages = require('../../error_messages');

module.exports = Helpers.withDefaults({
  method: 'GET',
  path: '/verify/{token}',
  options: {
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
        200: Joi.valid('ok'),
        400: Joi.any().example(Boom.badRequest(errorMessages.verificationCodeIsNotValid).output.payload)
          .description('Verification token is not valid')
      }
    }
  },
  handler: async (request, h) => {
    const { userService } = request.services();
    const { token } = request.params;
    
    try {
      await userService.verifyEmailAddress(token);

      return 'ok';
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
