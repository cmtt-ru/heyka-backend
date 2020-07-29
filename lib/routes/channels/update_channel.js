'use strict';

const Helpers = require('../helpers');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');
const schemas = require('../../schemas');
const errorMessages = require('../../error_messages');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/channels/{channelId}',
  options: {
    tags: ['api', 'channels'],
    description: 'Update the channel',
    validate: {
      payload: Joi.object({
        name: Joi.string().required().min(3).max(100),
        description: Joi.string().optional(),
      }).description('Update channel info').label('UpdateChannelInfo')
    },
    response: {
      status: {
        200: Joi.object({
          channel: schemas.channel
        }),
        404: Joi.any().example(Boom.forbidden(errorMessages.notFound).output.payload)
          .description('Channel not found'),
        403: Joi.any().example(Boom.forbidden(errorMessages.accessDenied).output.payload)
          .description('User hasn\'t access to the channel')
      },
      failAction: 'error',
    }
  },
  handler: async (request, h) => {
    const {
      channelService,
      displayService,
      permissionService
    } = request.services();
    const { userId } = request.auth.credentials;
    const { channelId } = request.params;
    
    try {
      const canUpdateChannel = await permissionService.canUpdateChannel(channelId, userId);
      if (!canUpdateChannel) {
        return Boom.forbidden(errorMessages.accessDenied);
      }

      const channel = await channelService.updateChannelInfo(channelId, request.payload);

      return {
        channel: displayService.channel(channel)
      };
    } catch (e) {
      if (e.message === 'ChannelNotFound') {
        return Boom.notFound(errorMessages.notFound);
      }
      request.log(['debug-error'], 'Error update channel: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
