'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const Joi = require('@hapi/joi');

module.exports = Helpers.withDefaults({
  method: 'GET',
  path: '/channels/{channelId}/select',
  options: {
    tags: ['api', 'channels'],
    description: 'Select a certain channel',
    validate: {
      query: Joi.object({
        socketId: Joi.string().required()
      })
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

      await channelService.selectChannel(channelId, userId, socketId);

      return 'ok';
    } catch (e) {
      request.log(['debug-error'], 'Error on select channel by user: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
