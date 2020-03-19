'use strict';

const Helpers = require('../helpers');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');
const schemas = require('../../schemas');

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
          avatar: Joi.string().uri().optional(),
          email: Joi.string().email().required(),
          password: Joi.string().min(4).required()
        }).label('SignupUserInfo')
      })
    },
    response: {
      failAction: 'error',
      schema: schemas.authedUser
    }
  },
  handler: async (request, h) => {
    const { user: userInfo } = request.payload;
    const { userService, displayService } = request.services();
    
    try {
      const user = await userService.signup(userInfo);
      const tokens = await userService.createTokens(user);

      return {
        user: displayService.user(user),
        credentials: tokens
      };
    } catch (e) {
      if (e.message === 'EmailExists') {
        return Boom.badRequest('A user with that email address has already signed up');
      }
      console.log('ERROR:::::', e);
      request.log(['debug-error'], 'Error on sign up user: ' + e);
      return Boom.internal();
    }
  }
});
