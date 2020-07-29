'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const Joi = require('@hapi/joi');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/workspaces/{workspaceId}/invite/email',
  options: {
    tags: ['api', 'workspaces'],
    description: 'Send invite to a user by email',
    validate: {
      payload: Joi.object({
        email: Joi.string().required().email()
      })
    }
  },
  handler: async (request, h) => {
    const {
      workspaceService,
      workspaceDatabaseService,
      emailService,
      permissionService
    } = request.services();
    const { userId } = request.auth.credentials;
    const { workspaceId } = request.params;
    const { email } = request.payload;
    
    try {
      const canInvite = await permissionService.canInviteWorkspace(workspaceId, userId);
      if (!canInvite) {
        return Boom.forbidden('UserCanNotInviteToWorkspace');
      }

      const code = await workspaceService.inviteToWorkspace(workspaceId, userId);
      const workspace = await workspaceDatabaseService.getWorkspaceById(workspaceId);
      await emailService.sendInviteToWorkspace(email, workspace.name, code.fullCode);

      return {
        status: 'success'
      };
    } catch (e) {
      request.log(['debug-error'], 'Error send invite: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
