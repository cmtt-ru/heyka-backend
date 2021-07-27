'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const schemas = require('../../schemas');
const Joi = require('@hapi/joi');
//const config = require('../../../config');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/channels/join/{token}',
  options: {
    // plugins: {
    //   'hapi-rate-limit': {
    //     pathLimit: config.pathLimit
    //   }
    // },
    tags: ['api', 'channels'],
    description: 'Select a certain channel by invite-token',
    auth: false,
    validate: {
      params: Joi.object({
        token: Joi.string().required(),
      }),
      payload: Joi.object({
        name: Joi.string().required(),
      }),
    },
    response: {
      status: {
        200: schemas.authedUser,
        // 429: Joi.any().example(Boom.tooManyRequests('Rate limit exceeded')).description('Too Many Requests')
      },
      failAction: 'error',
    }
  },
  handler: async (request, h) => {
    const {
      userService,
      displayService,
    } = request.services();
    const { token } = request.params;
    const { name } = request.payload;

    try {
      const userInfo = {
        name
      };
      const user = await userService.signupByChannelInvite(token, userInfo);
      const tokens = await userService.createTokens(user);

      return {
        user: displayService.userWithConfidentialData(user),
        credentials: tokens,
      };
    } catch (e) {
      if (e.message.includes('InvalidCode')) {
        return Boom.badRequest('Invalid invite code');
      }
      request.log(['debug-error'], 'Error on select channel by user: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
