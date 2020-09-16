'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const Joi = require('@hapi/joi');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/channels/{channelId}/invite',
  options: {
    tags: ['api', 'channels'],
    description: 'Get invite-JWT for non-member user',
    validate: {
      params: Joi.object({
        channelId: Joi.string().required().uuid(),
      }),
    },
    response: {
      failAction: 'error',
      status: {
        200: Joi.object({
          token: Joi.string().required(),
        })
      }
    }
  },
  handler: async (request, h) => {
    const {
      channelService,
      permissionService,
    } = request.services();
    const { userId } = request.auth.credentials;
    const { channelId } = request.params;
    
    try {
      const canInviteChannel = await permissionService.canInviteChannel(channelId, userId);

      if (!canInviteChannel) {
        return Boom.forbidden();
      }

      const token = await channelService.getInviteChannelToken(channelId, userId);

      return {
        token,
      };
    } catch (e) {
      if (e.message.includes('ChannelNotFound')) {
        return Boom.notFound('Channel not found');
      } else if (e.message.includes('WorkspaceNotFound')) {
        return Boom.notFound('Workspace not found');
      }

      request.log(['debug-error'], 'Error on generating invite to channel: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
