'use strict';

const Helpers = require('../helpers');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');
const schemas = require('../../schemas');

module.exports = Helpers.withDefaults({
  method: 'GET',
  path: '/workspaces/{workspaceId}/settings',
  options: {
    tags: ['api', 'workspaces'],
    description: 'Get detailed workspace settings',
    validate: {
      params: Joi.object({
        workspaceId: Joi.string().required().uuid(),
      }),
    },
    response: {
      status: {
        200: schemas.workspaceSettings,
      },
      failAction: 'log'
    }
  },
  handler: async (request, h) => {
    const {
      workspaceDatabaseService: wdb,
      permissionService,
      displayService
    } = request.services();
    const { workspaceId } = request.params;
    const { userId } = request.auth.credentials;
    
    try {
      const canUserManageWorkspace = await permissionService.canViewWorkspaceInfo(workspaceId, userId);
      if (!canUserManageWorkspace) {
        return Boom.forbidden();
      } 

      const workspace = await wdb.getWorkspaceById(workspaceId);

      return displayService.workspaceSettings(workspace);
    } catch (e) {
      request.log(['debug-error'], 'Error on get settings of workspace' + e + e.stack);
      return Boom.internal();
    }
  }
});
