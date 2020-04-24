'use strict';

const Helpers = require('../helpers');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');
const errorMessages = require('../../error_messages');

module.exports = Helpers.withDefaults({
  method: 'GET',
  path: '/verify/{code}',
  options: {
    auth: false,
    tags: ['api', 'auth'],
    description: 'Verify email address by verification code',
    validate: {
      params: Joi.object({
        code: Joi.string().required().length(82).description('Should have 82 characters length')
      })
    },
    response: {
      status: {
        200: Joi.valid('ok'),
        400: Joi.any().example(Boom.badRequest(errorMessages.verificationCodeIsNotValid).output.payload)
          .description('Verification code is not valid')
      }
    }
  },
  handler: async (request, h) => {
    const { userService } = request.services();
    const { code } = request.params;
    
    try {
      await userService.verifyEmailAddress(code);

      return 'ok';
    } catch (e) {
      switch (e.message) {
      case 'NotFound':
      case 'UserNotFound':
      case 'VerificationCodesNotMatched':
      case 'EmailNotMatched':
      case 'VerificationCodeExpired':
        return Boom.badRequest(errorMessages.verificationCodeIsNotValid);
      default:
        request.log(['debug-error'], 'Error on email verification: ', + e);
        return Boom.internal();
      }
    }
  }
});
