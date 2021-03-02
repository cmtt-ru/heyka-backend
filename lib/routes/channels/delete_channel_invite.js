'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const Joi = require('@hapi/joi');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/channel-invites/{inviteId}/deactivate',
  options: {
    tags: ['api', 'channels'],
    description: 'Deactivate invite token and delete all guest by this token',
    validate: {
      params: Joi.object({
        inviteId: Joi.string().required().uuid(),
      }),
    },
  },
  handler: async (request, h) => {
    const {
      inviteCodesDatabaseService: inviteCodes,
      workspaceService
    } = request.services();
    const { inviteId } = request.params;
    
    try {
      await workspaceService.kickUsersFromWorkspaceByInvite(inviteId);
      await inviteCodes.deleteInviteCode(inviteId);

      return 'ok';
    } catch (e) {
      request.log(['debug-error'], 'Error on deleting invite: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
