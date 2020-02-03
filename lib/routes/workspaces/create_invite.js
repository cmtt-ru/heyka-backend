'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/workspaces/{workspaceId}/invites',
  options: {
    tags: ['api', 'workspaces'],
    description: 'Creating invites in a certain workspace'
  },
  handler: async (request, h) => {
    const { workspaceService } = request.services();
    const { userId } = request.auth.credentials;
    const { workspaceId } = request.params;
    
    try {
      const canInvite = await workspaceService.canInviteToWorkspace(workspaceId, userId );
      if (!canInvite) {
        return Boom.forbidden('UserCanNotInviteToWorkspace');
      }

      const code = await workspaceService.inviteToWorkspace(workspaceId, userId);

      return {
        code: code.fullCode
      };
    } catch (e) {
      request.log(['debug-error'], 'Error create invite: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
