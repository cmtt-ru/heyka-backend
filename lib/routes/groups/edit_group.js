'use strict';

const Helpers = require('../helpers');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');
const schemas = require('../../schemas');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/groups/{groupId}',
  options: {
    tags: ['api', 'workspaces', 'groups'],
    description: 'Edit group',
    validate: {
      payload: Joi.object({
        name: Joi.string().required().min(2).max(100),
      }),
    },
    response: {
      status: {
        200: schemas.group,
      } 
    }
  },
  handler: async (request, h) => {
    const {
      groupDatabaseService,
      displayService,
      permissionService,
    } = request.services();
    const { userId } = request.auth.credentials;
    const { groupId } = request.params;
    
    try {
      const canCreateGroup = await permissionService.canUpdateGroup(groupId, userId);
      if (!canCreateGroup) {
        return Boom.unauthorized('UserCanNotUpdateGroup');
      }

      const group = await groupDatabaseService.getGroupById(groupId);
      
      if (!group) {
        return Boom.notFound('GroupNotFound');
      }

      group.name = request.payload.name;

      await groupDatabaseService.updateGroup(group.id, { name: group.name });

      return displayService.group(group);
    } catch (e) {
      request.log(['debug-error'], 'Error update group: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
