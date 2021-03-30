'use strict';

const Helpers = require('../helpers');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');

module.exports = Helpers.withDefaults({
  method: 'GET',
  path: '/workspaces/{workspaceId}/groups',
  options: {
    tags: ['api', 'workspaces', 'groups'],
    description: 'Get all workspace groups',
    response: {
      status: {
        200: Joi.array().items(Joi.object({
          id: Joi.string().uuid().required(),
          name: Joi.string().required(),
          membersCount: Joi.number(),
          updatedAt: Joi.date().required(),
          createdAt: Joi.date().required(),
          createdBy: Joi.string().uuid().required()
        }))
      }
    }
  },
  handler: async (request, h) => {
    const {
      groupDatabaseService,
      permissionService,
    } = request.services();
    const { userId } = request.auth.credentials;
    const { workspaceId } = request.params;
    
    try {
      const canManageGroup = await permissionService.canViewWorkspaceGroups(workspaceId, userId);
      if (!canManageGroup) {
        return Boom.unauthorized('UserCanNotViewWorkspaceGroups');
      }

      const groups = await groupDatabaseService.getGroupsByWorkspaceId(workspaceId);

      const formattedGroups = groups.map(group => ({
        id: group.id,
        name: group.name,
        createdAt: group.created_at,
        updatedAt: group.updated_at,
        createdBy: group.creator_id,
        membersCount: parseInt(group.members_count),
      }));

      return formattedGroups;
    } catch (e) {
      request.log(['debug-error'], 'Error on get all group data: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
