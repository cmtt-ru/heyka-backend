'use strict';

const Helpers = require('../helpers');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/auth-link',
  options: {
    tags: ['api', 'auth'],
    description: 'Creates one-time link for authentication',
    response: {
      failAction: 'error',
      schema: Joi.object({
        code: Joi.string().required()
      }).label('CreateAuthLinkResponse')
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
