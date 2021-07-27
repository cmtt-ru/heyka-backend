'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const Joi = require('@hapi/joi');
const schemas = require('../../schemas');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/channels/{channelId}/invite',
  options: {
    tags: ['api', 'channels'],
    description: 'Create invite token for non-member user',
    validate: {
      params: Joi.object({
        channelId: Joi.string().required().uuid(),
      }),
    },
    response: {
      failAction: 'log',
      status: {
        200: schemas.channelInvite,
      },
    },
  },
  handler: async (request, h) => {
    const {
      channelService,
      permissionService,
      displayService,
    } = request.services();
    const { userId } = request.auth.credentials;
    const { channelId } = request.params;
    
    try {
      const canInviteChannel = await permissionService.canInviteChannel(channelId, userId);

      if (!canInviteChannel) {
        return Boom.forbidden();
      }

      const channelInviteInfo = await channelService.getInviteChannelToken(channelId, userId);

      return displayService.channelInvite(channelInviteInfo);
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
