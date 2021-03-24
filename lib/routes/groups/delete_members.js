'use strict';

const Helpers = require('../helpers');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');

module.exports = Helpers.withDefaults({
  method: 'DELETE',
  path: '/groups/{groupId}/members',
  options: {
    tags: ['api', 'workspaces', 'groups'],
    description: 'Delete members in the group',
    validate: {
      payload: Joi.object({
        users: Joi.array().items(Joi.string().uuid()).required().min(1),
      }),
    },
  },
  handler: async (request, h) => {
    const {
      groupService,
      permissionService,
    } = request.services();
    const { userId } = request.auth.credentials;
    const { groupId } = request.params;
    
    try {
      const canManageGroup = await permissionService.canManageGroup(groupId, userId);
      if (!canManageGroup) {
        return Boom.unauthorized('UserCanNotManageGroup');
      }

      await Promise.all(request.payload.users.map(uId => groupService.deleteMemberFromGroup(groupId, uId)));

      return 'ok';
    } catch (e) {
      request.log(['debug-error'], 'Error while delete members from group: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
