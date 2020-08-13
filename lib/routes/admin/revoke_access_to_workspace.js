'use strict';

const Helpers = require('../helpers');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/admin/workspaces/revoke-access',
  options: {
    tags: ['api', 'admin'],
    description: 'Get list of workspaces that you can manage',
    validate: {
      payload: Joi.object({
        workspaceId: Joi.string().uuid().required(),
        userId: Joi.string().uuid().required()
      })
    },
  },
  handler: async (request, h) => {
    const {
      workspaceService,
      permissionService
    } = request.services();
    const { userId } = request.auth.credentials;
    const {
      workspaceId,
      userId: kickedUserId
    } = request.payload;
    
    try {
      const canDoIt = await permissionService.canRevokeAccessWorkspace(workspaceId, userId, kickedUserId);

      if (!canDoIt) {
        return Boom.forbidden();
      } 

      await workspaceService.kickUserFromWorkspace(workspaceId, kickedUserId);

      return 'ok';
    } catch (e) {
      request.log(['debug-error'], 'Error on revoking access to workspace' + e + e.stack);
      return Boom.internal();
    }
  }
});
