'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');

module.exports = Helpers.withDefaults({
  method: 'DELETE',
  path: '/groups/{groupId}',
  options: {
    tags: ['api', 'workspaces', 'groups'],
    description: 'Delete group',
  },
  handler: async (request, h) => {
    const {
      groupDatabaseService,
      permissionService,
    } = request.services();
    const { userId } = request.auth.credentials;
    const { groupId } = request.params;
    
    try {
      const canCreateGroup = await permissionService.canUpdateGroup(groupId, userId);
      if (!canCreateGroup) {
        return Boom.unauthorized('UserCanNotDeleteGroup');
      }

      const group = await groupDatabaseService.getGroupById(groupId);

      if (!group) {
        return Boom.notFound('GroupNotFound');
      }

      await groupDatabaseService.deleteGroup(groupId);

      return 'ok';
    } catch (e) {
      request.log(['debug-error'], 'Error delete group: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
