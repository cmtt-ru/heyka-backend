'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const Joi = require('@hapi/joi');
const errorMessages = require('../../error_messages');

module.exports = Helpers.withDefaults({
  method: 'DELETE',
  path: '/channels/{channelId}',
  options: {
    tags: ['api', 'channels'],
    description: 'Delete the channel',
    response: {
      status: {
        200: Joi.valid('ok'),
        404: Joi.any().example(Boom.forbidden(errorMessages.notFound).output.payload)
          .description('Channel not found'),
        403: Joi.any().example(Boom.forbidden(errorMessages.accessDenied).output.payload)
          .description('User hasn\'t access to the channel')
      },
      failAction: 'error',
    }
  },
  handler: async (request, h) => {
    const { channelService } = request.services();
    const { userId } = request.auth.credentials;
    const { channelId } = request.params;
    
    try {
      const canUpdateChannel = await channelService.canUpdateOrDeleteChannel(channelId, userId);
      if (!canUpdateChannel) {
        return Boom.forbidden(errorMessages.accessDenied);
      }

      await channelService.deleteChannel(channelId);

      return 'ok';
    } catch (e) {
      if (e.message === 'ChannelNotFound') {
        return Boom.notFound(errorMessages.notFound);
      }
      request.log(['debug-error'], 'Error on delete channel: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
