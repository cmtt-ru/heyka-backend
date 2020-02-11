'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const Joi = require('@hapi/joi');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/workspaces/{workspaceId}/invite/slack',
  options: {
    tags: ['api', 'workspaces'],
    description: 'Send invite to a user by slack',
    validate: {
      payload: Joi.object({
        slackUserId: Joi.string().required()
      })
    }
  },
  handler: async (request, h) => {
    const {
      workspaceService,
      workspaceDatabaseService,
      slackService,
      userService
    } = request.services();
    const { userId } = request.auth.credentials;
    const { workspaceId } = request.params;
    const { slackUserId } = request.payload;
    
    try {
      const canInvite = await workspaceService.canInviteToWorkspace(workspaceId, userId);
      if (!canInvite) {
        return Boom.forbidden('NotAllowed');
      }
      
      const user = await userService.findById(userId);

      if (!user) {
        return Boom.badRequest('UserNotFound');
      }

      if (!user.auth.slack) {
        return Boom.badRequest('UserNotAuthedWithSlack');
      }

      const workspace = await workspaceDatabaseService.getWorkspaceById(workspaceId);

      if (!workspace) {
        return Boom.badRequest('WorkspaceNotFound');
      }

      if (!workspace.slack.ok) {
        return Boom.badRequest('SlackIsNotConnected');
      }

      const code = await workspaceService.inviteToWorkspace(workspaceId, userId);
      await slackService.sendInviteToWorkspace(
        user.auth.slack.params.user_id,
        workspace.slack.access_token,
        slackUserId,
        workspace.name,
        code.fullCode
      );

      return {
        status: 'success'
      };
    } catch (e) {
      request.log(['debug-error'], 'Error send invite: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
