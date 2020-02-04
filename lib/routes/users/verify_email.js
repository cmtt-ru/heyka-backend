'use strict';

const Helpers = require('../helpers');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');

module.exports = Helpers.withDefaults({
  method: 'GET',
  path: '/verify/{code}',
  options: {
    auth: false,
    tags: ['api', 'auth'],
    description: 'Verify email address by verification code',
    validate: {
      params: Joi.object({
        code: Joi.string().required().length(82)
      })
    }
  },
  handler: async (request, h) => {
    const { userService } = request.services();
    const { code } = request.params;
    
    try {
      await userService.verifyEmailAddress(code);

      return { status: 'success' };
    } catch (e) {
      switch (e.message) {
      case 'NotFound':
      case 'UserNotFound':
      case 'VerificationCodesNotMatched':
      case 'EmailNotMatched':
      case 'VerificationCodeExpired':
        return { status: 'fail', reason: 'Verification code is not valid' };
      default:
        request.log(['debug-error'], 'Error on email verification: ', + e);
        return Boom.internal();
      }
    }
  }
});
