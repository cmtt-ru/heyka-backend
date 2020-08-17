'use strict';

const Helpers = require('../helpers');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');
const errorMessages = require('../../error_messages');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/reset-password',
  options: {
    auth: false,
    tags: ['api', 'auth'],
    description: 'Reset password',
    validate: {
      payload: Joi.object({
        token: Joi.string().required(),
        password: Joi.string().required(),
      }),
    },
    response: {
      status: {
        200: Joi.object({
          code: Joi.string().required()
        })
      },
      failAction: 'error',
    }
  },
  handler: async (request, h) => {
    const { token, password } = request.payload;
    const { userService } = request.services();
    
    try {
      const user = await userService.resetPassword(token, password);
      const code = await userService.createAuthLink(user.id);

      return {
        code
      };
    } catch (e) {
      if (e.message === 'TokenIsInvalid') {
        return Boom.badRequest(errorMessages.tokenIsInvalid);
      } else if (e.message === 'NotFound') {
        return Boom.notFound();
      }
      request.log(['debug-error'], 'Error on reset password: ' + e);
      return Boom.internal();
    }
  }
});
