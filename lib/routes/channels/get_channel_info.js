'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const Joi = require('@hapi/joi');
const schemas = require('../../schemas');
const errorMessages = require('../../error_messages');

module.exports = Helpers.withDefaults({
  method: 'GET',
  path: '/channels/{channelId}',
  options: {
    tags: ['api', 'channels'],
    description: 'Get channel info',
    response: {
      status: {
        200: schemas.channel.label('Channel details'),
        403: Joi.any().example(Boom.forbidden(errorMessages.accessDenied).output.payload)
          .description('User hasn\'t access to the channel')
      },
      failAction: 'error',
    }
  },
  handler: async (request, h) => {
    const {
      channelService,
      channelDatabaseService: chdb,
      displayService
    } = request.services();
    const { userId } = request.auth.credentials;
    const { channelId } = request.params;
    
    try {
      const canSelect = await channelService.canSelectChannel(channelId, userId);

      if (!canSelect) {
        return Boom.forbidden(errorMessages.accessDenied);
      }

      const channelInfo = await chdb.getChannelById(channelId);

      return displayService.channel(channelInfo);
    } catch (e) {
      request.log(['debug-error'], 'Error on get channel info: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
