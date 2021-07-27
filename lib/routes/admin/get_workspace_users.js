'use strict';

const Helpers = require('../helpers');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');
const schemas = require('../../schemas');

const responseSchema = Joi.object({
  users: Joi.array().items(schemas.workspaceMembersForAdmin).required()
}).label('WorkspaceState');

module.exports = Helpers.withDefaults({
  method: 'GET',
  path: '/admin/workspaces/{workspaceId}/users',
  options: {
    tags: ['api', 'admin'],
    description: 'Get workspace users for admins',
    validate: {
      params: Joi.object({
        workspaceId: Joi.string().uuid().required()
      })
    },
    response: {
      status: {
        200: responseSchema,
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
    const { workspaceId } = request.params;
    const { userId } = request.auth.credentials;

    try {
      const canDoIt = await permissionService.canViewUsersStatisticWorkspace(workspaceId, userId);
      
      if (!canDoIt) {
        return Boom.forbidden();
      }
      
      const users = await wdb.getWorkspaceMembersForAdmin(workspaceId);
      const response = {
        users: users.map(u => displayService.workspaceMemberForAdmin(u))
      };
      return response;
    } catch (e) {

      request.log(['debug-error'], 'Error on get list of users in workspace for admin' + e + e.stack);
      return Boom.internal();
    }
  }
});
