'use strict';

const Helpers = require('../helpers');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');
const schemas = require('../../schemas');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/workspaces/{workspaceId}/groups',
  options: {
    tags: ['api', 'workspaces', 'groups'],
    description: 'Create group in workspace',
    validate: {
      payload: Joi.object({
        name: Joi.string().required().min(2).max(100),
        users: Joi.array().items(Joi.string().uuid()).required(),
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
      groupService,
      displayService,
      permissionService,
    } = request.services();
    const { userId } = request.auth.credentials;
    const { workspaceId } = request.params;
    
    try {
      const canCreateGroup = await permissionService.canCreateGroupWorkspace(workspaceId, userId);
      if (!canCreateGroup) {
        return Boom.unauthorized('UserCanNotCreateGroups');
      }

      const group = await groupService.createGroup(workspaceId, userId, request.payload);

      return displayService.group(group);
    } catch (e) {
      request.log(['debug-error'], 'Error create group: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
