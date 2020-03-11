'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const Joi = require('@hapi/joi');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/workspaces/{workspaceId}/leave',
  options: {
    tags: ['api', 'workspaces'],
    description: 'Leave the workspace',
    validate: {
      params: Joi.object({
        workspaceId: Joi.string().uuid().required()
      })
    }
  },
  handler: async (request, h) => {
    const { userId } = request.auth.credentials;
    const { workspaceId } = request.params;
    const { workspaceService } = request.services();

    try {
      await workspaceService.kickUserFromWorkspace(workspaceId, userId);

      return 'ok';
    } catch (e) {
      if (e.message === 'LastAdmin') {
        return Boom.forbidden('User can\'t leave the workspace because he is the last admin');
      } else if (e.message === 'ActiveConversation') {
        return Boom.forbidden('User can\'t leave the workspace because he has an active conversation');
      }
      request.log(['debug-error'], 'Error kick user from workspace: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
