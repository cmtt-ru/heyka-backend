'use strict';

const Helpers = require('../helpers');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');
const schemas = require('../../schemas');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/signin',
  options: {
    tags: ['api', 'auth'],
    auth: false,
    description: 'Sign in user with email and password',
    validate: {
      payload: Joi.object({
        credentials: Joi.object({
          email: Joi.string().email().required(),
          password: Joi.string().min(4).required()
        }).label('SigninUserCredentials')
      })
    },
    response: {
      failAction: 'error',
      schema: schemas.authedUser
    }
  },
  handler: async (request, h) => {
    const { credentials: userInfo } = request.payload;
    const { userService, displayService } = request.services();
    
    try {
      const user = await userService.signin(userInfo);
      const tokens = await userService.createTokens(user);

      return {
        user: displayService.user(user),
        credentials: tokens
      };
    } catch (e) {
      if (e.message === 'InvalidPassword' || e.message === 'UserNotFound') {
        return Boom.unauthorized('Email or password are invalid');
      }
      request.log(['debug-error'], 'Error on sign up user: ', e);
      return Boom.internal();
    }
  }
});
