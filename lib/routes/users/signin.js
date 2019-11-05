'use strict';

const Helpers = require('../helpers');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/signin',
  options: {
    auth: false,
    validate: {
      payload: {
        credentials: Joi.object().keys({
          email: Joi.string().email().required(),
          password: Joi.string().min(4).required()
        }).required()
      }
    }
  },
  handler: async (request, h) => {
    const { credentials: userInfo } = request.payload;
    const { userService, displayService } = request.services();
    
    try {
      const user = await userService.signin(userInfo);
      const tokens = await userService.createTokens(user);

      return {
        user: displayService.user(user, tokens)
      };
    } catch (e) {
      if (e.message === 'InvalidPassword' || e.message === 'UserNotFound') {
        return Boom.unauthorized('Email or password are invalid');
      }
      console.log('Error on sign up user: ', e);
      return Boom.internal();
    }
  }
});
