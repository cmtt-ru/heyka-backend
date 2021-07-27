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
        200: Joi.object({
          channel: schemas.channel.required(),
          users: Joi.array().items(schemas.userMediaStateWithId).required()
        }).label('Channel defails'),
        403: Joi.any().example(Boom.forbidden(errorMessages.accessDenied).output.payload)
          .description('User hasn\'t access to the channel')
      },
      failAction: 'error',
    }
  },
  handler: async (request, h) => {
    const {
      channelDatabaseService: chdb,
      displayService,
      connectionService,
      permissionService
    } = request.services();
    const { userId } = request.auth.credentials;
    const { channelId } = request.params;
    
    try {
      const canSelect = await permissionService.canSelectChannel(channelId, userId);

      if (!canSelect) {
        return Boom.forbidden(errorMessages.accessDenied);
      }

      const [
        channelInfo,
        userMediaStates
      ] = await Promise.all([
        chdb.getChannelById(channelId),
        connectionService.getChannelConnections(channelId)
      ]);

      return {
        channel: displayService.channel(channelInfo),
        users: userMediaStates.map(conn => ({ userId: conn.userId, ...conn.mediaState }))
      };
    } catch (e) {
      request.log(['debug-error'], 'Error on get channel info: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
