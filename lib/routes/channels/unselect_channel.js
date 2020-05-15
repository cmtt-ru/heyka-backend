'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const Joi = require('@hapi/joi');
const errorMessages = require('../../error_messages');
const schemas = require('../../schemas');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/channels/{channelId}/unselect',
  options: {
    tags: ['api', 'channels'],
    description: 'Unselect a certain channel',
    validate: {
      query: Joi.object({
        socketId: Joi.string().required()
      })
    },
    response: {
      status: {
        200: Joi.valid('ok'),
        400: schemas.boomError.description(`
          message="${errorMessages.channelNotSelected}"
            You tried to unselect the channel that hasn't been selected by user
          message="${errorMessages.channelSelectedByAnotherDevice}"
            You tried to unselect the channel that has been selected with another device (another socketId)
        `)
      }
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
      await channelService.unselectChannel(channelId, userId, socketId);
      return 'ok';
    } catch (e) {
      if (e.message === 'ChannelIsNotSelected') {
        return Boom.badRequest('Channel is not selected');
      } else if (e.message === 'ChannelIsSelectedOnAnotherDevice') {
        return Boom.badRequest('Channel was selected by another device');
      }
      request.log(['debug-error'], 'Error on unselect channel by user: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
