'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const Joi = require('@hapi/joi');
const schemas = require('../../schemas');

module.exports = Helpers.withDefaults({
  method: 'GET',
  path: '/check/{code}',
  options: {
    tags: ['api', 'workspaces'],
    auth: false,
    description: 'Check invite code',
    validate: {
      params: Joi.object({
        code: Joi.string().required(),
      })
    },
    response: {
      failAction: 'error',
      status: {
        200: Joi.object({
          user: schemas.user,
          workspace: schemas.workspace,
          email: Joi.string().email().optional(),
        }).label('CheckInviteResponse')
      }
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
        return Boom.badRequest('Invite code is not valid');
      }

      const result = {
        user: displayService.user(info.user),
        workspace: displayService.workspace(info.workspace),
      };

      if (info.email) {
        result.email = info.email;
      }

      return result;
    } catch (e) {
      request.log(['debug-error'], 'Error check invite: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
