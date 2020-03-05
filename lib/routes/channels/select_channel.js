'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const Joi = require('@hapi/joi');
const schemas = require('../../schemas');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/channels/{channelId}/select',
  options: {
    tags: ['api', 'channels'],
    description: 'Select a certain channel',
    validate: {
      query: Joi.object({
        socketId: Joi.string().required()
      }),
      payload: schemas.userMediaState
    },
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
    const { socketId } = request.query;
    
    try {
      const canSelect = await channelService.canSelectChannel(channelId, userId);

      if (!canSelect) {
        return Boom.forbidden('UserCanNotSelectChannel');
      }

      await channelService.selectChannel(channelId, userId, socketId, request.payload);
      const userMediaStates = await channelService.usersMediaStateInChannel(channelId);

      return userMediaStates;
    } catch (e) {
      request.log(['debug-error'], 'Error on select channel by user: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
