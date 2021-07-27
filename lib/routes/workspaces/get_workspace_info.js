'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const schemas = require('../../schemas');
const Joi = require('@hapi/joi');

module.exports = Helpers.withDefaults({
  method: 'GET',
  path: '/workspaces/{workspaceId}/info',
  options: {
    tags: ['api', 'workspaces'],
    description: 'Get workspace info',
    validate: {
      params: Joi.object({
        workspaceId: Joi.string().required().uuid(),
      }),
    },
    response: {
      status: {
        200: schemas.workspace,
      },
      failAction: 'log'
    }
  },
  handler: async (request, h) => {
    const {
      workspaceDatabaseService: wdb,
      displayService,
      permissionService,
    } = request.services();
    const { userId } = request.auth.credentials;
    const { workspaceId } = request.params;
    
    try {
      const canView = await permissionService.canViewWorkspaceInfo(workspaceId, userId);

      if (!canView) {
        return Boom.forbidden();
      }

      const workspace = await wdb.getWorkspaceById(workspaceId);
      return displayService.workspace(workspace);
    } catch (e) {
      request.log(['debug-error'], 'Error on get workspace info' + e + e.stack);
      return Boom.internal();
    }
  }
});
