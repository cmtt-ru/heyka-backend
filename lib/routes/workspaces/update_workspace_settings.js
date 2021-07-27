'use strict';

const Helpers = require('../helpers');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');
const schemas = require('../../schemas');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/workspaces/{workspaceId}/settings',
  options: {
    tags: ['api', 'workspaces'],
    description: 'Update the workspace',
    validate: {
      params: Joi.object({
        workspaceId: Joi.string().required().uuid(),
      }),
      payload: Joi.object({
        canUsersInvite: Joi.boolean().required(),
      }),
    },
    response: {
      schema: Joi.object({
        workspace: schemas.workspaceSettings
      }),
      failAction: 'log'
    }
  },
  handler: async (request, h) => {
    const {
      workspaceService,
      displayService,
      permissionService,
    } = request.services();
    const { canUsersInvite } = request.payload;
    const { workspaceId } = request.params;
    const { userId } = request.auth.credentials;
    
    try {
      const canUpdateWorkspace = await permissionService.canUpdateWorkspace(workspaceId, userId);

      if (!canUpdateWorkspace) {
        return Boom.forbidden();
      }

      const workspace = await workspaceService.updateWorkspaceSettings(workspaceId, {
        canUsersInvite
      });

      return {
        workspace: displayService.workspaceSettings(workspace)
      };
    } catch (e) {
      if (e.message.includes('NotFound')) {
        return Boom.notFound();
      }
      request.log(['debug-error'], 'Error on update workspace settings: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
