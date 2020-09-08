'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const Joi = require('@hapi/joi');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/workspaces/{workspaceId}/invite/email',
  options: {
    tags: ['api', 'workspaces'],
    description: 'Send invites to the list of users by email',
    validate: {
      payload: Joi.object({
        emailList: Joi.array().items(Joi.string().email()).min(1),
      })
    }
  },
  handler: async (request, h) => {
    const {
      workspaceService,
      workspaceDatabaseService,
      userDatabaseService: udb,
      emailService,
      permissionService
    } = request.services();
    const { userId } = request.auth.credentials;
    const { workspaceId } = request.params;
    const { emailList } = request.payload;

    try {
      const canInvite = await permissionService.canInviteWorkspace(workspaceId, userId);
      if (!canInvite) {
        return Boom.forbidden('UserCanNotInviteToWorkspace');
      }

      const code = await workspaceService.inviteToWorkspace(workspaceId, userId);
      const [
        workspace,
        user,
      ] = await Promise.all([
        workspaceDatabaseService.getWorkspaceById(workspaceId),
        udb.findById(userId),
      ]);
      await Promise.all(
        emailList.map(email => emailService.sendInviteToWorkspace(email, workspace, user, code.fullCode))
      );

      return 'ok';
    } catch (e) {
      request.log(['debug-error'], 'Error send invite by email: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
