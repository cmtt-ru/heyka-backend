'use strict';

const Helpers = require('../helpers');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');
const schemas = require('../../schemas');

module.exports = Helpers.withDefaults({
  method: 'GET',
  path: '/groups/{groupId}/members',
  options: {
    tags: ['api', 'workspaces', 'groups'],
    description: 'Get all workspace groups',
    response: {
      status: {
        200: Joi.array().items(schemas.user)
      }
    }
  },
  handler: async (request, h) => {
    const {
      groupDatabaseService,
      permissionService,
      displayService
    } = request.services();
    const { userId } = request.auth.credentials;
    const { groupId } = request.params;
    
    try {
      const canViewGroup = await permissionService.canViewGroup(groupId, userId);
      if (!canViewGroup) {
        return Boom.unauthorized('UserCanNotViewGroup');
      }

      const users = await groupDatabaseService.getGroupMembers(groupId);

      const formattedUsers = users.map(user => displayService.user(user));

      return formattedUsers;
    } catch (e) {
      request.log(['debug-error'], 'Error on get all group members: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
