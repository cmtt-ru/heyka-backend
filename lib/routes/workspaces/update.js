'use strict';

const Helpers = require('../helpers');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');
const schemas = require('../../schemas');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/workspaces/{workspaceId}',
  options: {
    tags: ['api', 'workspaces'],
    description: 'Update the workspace',
    validate: {
      params: Joi.object({
        workspaceId: Joi.string().required().uuid(),
      }),
      payload: Joi.object({
        name: Joi.string().optional().min(3).max(100),
        avatarFileId: Joi.string().uuid().optional().allow(null),
      }).description('Workspace info').label('UpdateWorkspaceInfo'),
    },
    response: {
      schema: Joi.object({
        workspace: schemas.workspace
      }).label('UpdatedWOrkspaceInfo'),
      failAction: 'log'
    }
  },
  handler: async (request, h) => {
    const { name, avatarFileId } = request.payload;
    const {
      workspaceService,
      displayService,
      permissionService,
    } = request.services();
    const { workspaceId } = request.params;
    const { userId } = request.auth.credentials;
    
    try {
      const canUpdateWorkspace = await permissionService.canUpdateWorkspace(workspaceId, userId);

      if (!canUpdateWorkspace) {
        return Boom.forbidden();
      }

      const workspace = await workspaceService.updateWorkspace(workspaceId, {
        name,
        avatarFileId
      });

      return {
        workspace: displayService.workspace(workspace)
      };
    } catch (e) {
      if (e.message.includes('NotFound')) {
        return Boom.notFound();
      }
      request.log(['debug-error'], 'Error create workspace: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
