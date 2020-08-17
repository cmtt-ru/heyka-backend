'use strict';

const Helpers = require('../helpers');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');
const schemas = require('../../schemas');
const errorMessages = require('../../error_messages');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/signup',
  options: {
    auth: false,
    tags: ['api', 'auth'],
    description: 'Sign up user with email and password',
    validate: {
      payload: Joi.object({
        user: Joi.object({
          name: Joi.string().max(100).required(),
          lang: Joi.string().optional(),
          email: Joi.string().email().required(),
          password: Joi.string().min(4).required()
        }).label('SignupUserInfo')
      })
    },
    response: {
      failAction: 'error',
      status: {
        200: schemas.authedUser,
        400: Joi.any().example(Boom.badRequest(errorMessages.emailExists).output.payload)
      }
    }
  },
  handler: async (request, h) => {
    const { user: userInfo } = request.payload;
    const { userService, displayService } = request.services();
    
    try {
      const user = await userService.signup(userInfo);
      const tokens = await userService.createTokens(user);

      return {
        user: displayService.userWithConfidentialData(user),
        credentials: tokens
      };
    } catch (e) {
      if (e.message === 'EmailExists') {
        return Boom.badRequest(errorMessages.emailExists);
      }
      request.log(['debug-error'], 'Error on sign up user: ' + e);
      return Boom.internal();
    }
  }
});
