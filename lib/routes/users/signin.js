'use strict';

const Helpers = require('../helpers');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');
const schemas = require('../../schemas');
const errorMessages = require('../../error_messages');
const config = require('../../../config');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/signin',
  options: {
    plugins: {
      'hapi-rate-limit': {
        pathLimit: config.pathLimit
      }
    },
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
      status: {
        200: schemas.authedUser,
        401: Joi.any().example(Boom.unauthorized(errorMessages.emailOrPasswordAreInvalid).output.payload)
          .description('Given email or password are not valid'),
        429: Joi.any().example(Boom.tooManyRequests('Rate limit exceeded')).description('Too Many Requests')
      },
      failAction: 'error'
    }
  },
  handler: async (request, h) => {
    const { credentials: userInfo } = request.payload;
    const { userService, displayService } = request.services();
    
    try {
      const user = await userService.signin(userInfo);
      const tokens = await userService.createTokens(user);

      return {
        user: displayService.userWithConfidentialData(user),
        credentials: tokens
      };
    } catch (e) {
      if (e.message === 'InvalidPassword' || e.message === 'UserNotFound') {
        return Boom.unauthorized(errorMessages.emailOrPasswordAreInvalid);
      }
      request.log(['debug-error'], 'Error on sign up user: ', e);
      return Boom.internal();
    }
  }
});
