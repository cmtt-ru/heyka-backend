'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const Joi = require('@hapi/joi');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/channels/{channelId}/leave',
  options: {
    tags: ['api', 'channels'],
    description: 'Leave the channel',
    validate: {
      params: Joi.object({
        channelId: Joi.string().uuid().required()
      })
    }
  },
  handler: async (request, h) => {
    const { userId } = request.auth.credentials;
    const { channelId } = request.params;
    const { workspaceService } = request.services();

    try {
      await workspaceService.kickUserFromChannel(channelId, userId);

      return 'ok';
    } catch (e) {
      if (e.message === 'ActiveConversation') {
        return Boom.forbidden('User can\'t leave the workspace because he has an active conversation');
      }
      request.log(['debug-error'], 'Error create workspace: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
