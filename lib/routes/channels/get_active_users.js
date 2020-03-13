'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const Joi = require('@hapi/joi');
const schemas = require('../../schemas');

module.exports = Helpers.withDefaults({
  method: 'GET',
  path: '/channels/{channelId}/active-users',
  options: {
    tags: ['api', 'channels'],
    description: 'Get active users list of this channel with media states',
    response: {
      failAction: 'error',
      schema: Joi.array().items(schemas.userMediaStateWithId)
    }
  },
  handler: async (request, h) => {
    const {
      channelService
    } = request.services();
    const { userId } = request.auth.credentials;
    const { channelId } = request.params;
    
    try {
      const canSelect = await channelService.canSelectChannel(channelId, userId);

      if (!canSelect) {
        return Boom.forbidden('UserCanNotSelectChannel');
      }

      const userMediaStates = await channelService.usersMediaStateInChannel(channelId);

      return userMediaStates;
    } catch (e) {
      request.log(['debug-error'], 'Error on getting active users in channel: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
