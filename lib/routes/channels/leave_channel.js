'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const Joi = require('@hapi/joi');
const errorMessages = require('../../error_messages');

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
    },
    response: {
      status: {
        200: Joi.allow('ok'),
        403: Joi.any().example(Boom.forbidden(errorMessages.activeConversation).output.payload)
          .description('User can\'t leave the channel because of an active conversation in it')
      }
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
        return Boom.forbidden(errorMessages.activeConversation);
      }
      request.log(['debug-error'], 'Error create workspace: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
