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
  },
  handler: async (request, h) => {
    const { token, password } = request.payload;
    const { userService } = request.services();
    
    try {
      await userService.resetPassword(token, password);

      return 'ok';
    } catch (e) {
      if (e.message === 'TokenIsInvalid') {
        return Boom.badData(errorMessages.tokenIsInvalid);
      } else if (e.message === 'NotFound') {
        return Boom.notFound();
      }
      request.log(['debug-error'], 'Error on sign up user: ' + e);
      return Boom.internal();
    }
  }
});
