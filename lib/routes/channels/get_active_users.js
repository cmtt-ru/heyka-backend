'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const Joi = require('@hapi/joi');
const schemas = require('../../schemas');
const errorMessages = require('../../error_messages');

module.exports = Helpers.withDefaults({
  method: 'GET',
  path: '/channels/{channelId}/active-users',
  options: {
    tags: ['api', 'channels'],
    description: 'Get active users list of this channel with media states',
    response: {
      status: {
        200: Joi.array().items(schemas.userMediaStateWithId).label('User media state list'),
        403: Joi.any().example(Boom.forbidden(errorMessages.accessDenied).output.payload)
          .description('User hasn\'t access to the channel')
      },
      failAction: 'log',
    }
  },
  handler: async (request, h) => {
    const {
      connectionService,
      permissionService,
    } = request.services();
    const { userId } = request.auth.credentials;
    const { channelId } = request.params;
    
    try {
      const canSelect = await permissionService.canSelectChannel(channelId, userId);

      if (!canSelect) {
        return Boom.forbidden(errorMessages.accessDenied);
      }

      const userMediaStates = await connectionService.getChannelConnections(channelId);

      return userMediaStates.map(conn => ({ userId: conn.userId, ...conn.mediaState }));
    } catch (e) {
      request.log(['debug-error'], 'Error on getting active users in channel: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
