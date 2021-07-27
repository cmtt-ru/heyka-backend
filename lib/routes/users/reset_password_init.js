'use strict';

const Helpers = require('../helpers');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');
const config = require('../../../config');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/reset-password/init',
  options: {
    plugins: {
      'hapi-rate-limit': {
        pathLimit: config.pathLimit
      }
    },
    auth: false,
    tags: ['api', 'auth'],
    description: 'Reset password (Send token to email)',
    validate: {
      payload: Joi.object({
        email: Joi.string().email().required(),
      }),
    },
    response: {
      status: {
        429: Joi.any().example(Boom.tooManyRequests('Rate limit exceeded')).description('Too Many Requests')
      },
      failAction: 'error',
    }
  },
  handler: async (request, h) => {
    const { email } = request.payload;
    const { userService } = request.services();
    
    try {
      await userService.resetPasswordInit(email);

      return 'ok';
    } catch (e) {
      if (e.message === 'UserNotFound') {
        return 'ok';
      } else if (e.message === 'EmailNotVerified') {
        return 'ok';
      }
      request.log(['debug-error'], 'Error on sign up user: ' + e);
      return Boom.internal();
    }
  }
});
