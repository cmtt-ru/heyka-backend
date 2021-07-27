'use strict';

const Helpers = require('../helpers');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/create-auth-link',
  options: {
    tags: ['api', 'auth'],
    description: 'Creates one-time link for authentication',
    response: {
      status: {
        200: Joi.object({
          code: Joi.string().required()
        }).label('CreateAuthLinkResponse')
      },
      failAction: 'log',
    }
  },
  handler: async (request, h) => {
    const { userService } = request.services();
    const { userId } = request.auth.credentials;
    
    try {
      const code = await userService.createAuthLink(userId);
      return {
        code
      };
    } catch (e) {
      request.log(['debug-error'], 'Error creation auth link: ' + e);
      return Boom.internal();
    }
  }
});
