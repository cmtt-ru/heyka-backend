'use strict';

const Helpers = require('../../helpers');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');

module.exports = Helpers.withDefaults({
  method: 'GET',
  path: '/workspaces/{workspaceId}/slack/detach',
  options: {
    tags: ['api', 'workspaces'],
    description: 'Detach slack account for workspace',
    validate: {
      params: Joi.object({
        workspaceId: Joi.string().uuid().required()
      })
    },
  },
  handler: async (request, h) => {
    const { 
      workspaceService, 
      permissionService,
    } = request.services();
    const { workspaceId } = request.params;
    const { userId } = request.auth.credentials;
    
    try {
      const isAllowed = await permissionService.canConnectSlackWorkspace(workspaceId, userId);
      if (!isAllowed) {
        return Boom.unauthorized('UserCannotDetachSlack');
      }

      await workspaceService.detachSlack(workspaceId);
      return 'ok';
    } catch (e) {
      request.log(['debug-error'], 'Error on detach slack: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
