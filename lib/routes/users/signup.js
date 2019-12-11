'use strict';

const Helpers = require('../helpers');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/signup',
  options: {
    auth: false,
    validate: {
      payload: {
        user: Joi.object().keys({
          email: Joi.string().email().required(),
          password: Joi.string().min(4).required()
        }).required()
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
        user: displayService.user(user, tokens)
      };
    } catch (e) {
      if (e.message === 'EmailExists') {
        return Boom.badRequest('A user with that email address has already signed up');
      }
      request.log(['debug-error'], 'Error on sign up user: ' + e);
      return Boom.internal();
    }
  }
});
