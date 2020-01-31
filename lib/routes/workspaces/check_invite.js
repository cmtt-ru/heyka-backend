'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const Joi = require('@hapi/joi');

module.exports = Helpers.withDefaults({
  method: 'GET',
  path: '/check/{code}',
  options: {
    tags: ['api', 'workspaces'],
    auth: false,
    description: 'Check invite code',
    validate: {
      params: Joi.object({
        code: Joi.string().required().length(82).regex(/^[0-9a-f]{82}$/i)
      })
    }
  },
  handler: async (request, h) => {
    const { workspaceService, displayService } = request.services();
    const { code } = request.params;
    
    try {
      const info = await workspaceService.getInviteInfo(code);
      const isNotValid = info.status === 'NotFound'
        || info.status === 'Expired'
        || info.status === 'NotMatched';
      
      if (isNotValid) {
        return { valid: false };
      }

      return {
        valid: true,
        user: displayService.user(info.user),
        workspace: displayService.workspace(info.workspace)
      };
    } catch (e) {
      request.log(['debug-error'], 'Error check invite: ' + e + e.stack);
      return Boom.internal();
    }
  }
});