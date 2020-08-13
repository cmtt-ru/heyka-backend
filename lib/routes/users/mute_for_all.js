'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const Joi = require('@hapi/joi');
const errorMessages = require('../../error_messages');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/mute-for-all',
  options: {
    tags: ['api', 'user'],
    description: 'Send a signal to mute a user from your current channel',
    validate: {
      payload: Joi.object({
        userId: Joi.string().uuid().required(),
      }),
      query: Joi.object({
        socketId: Joi.string().required()
      })
    },
    response: {
      status: {
        200: Joi.valid('ok')
      }
    }
  },
  handler: async (request, h) => {
    const { 
      userService
    } = request.services();
    const { userId: userId } = request.auth.credentials;
    const {
      userId: muteUserId
    } = request.payload;
    const {
      socketId
    } = request.query;

    try {
      await userService.muteForAll(userId, socketId, muteUserId);
      return 'ok';
    } catch (e) {
      if (e.message === 'ConnectionNotFound') {
        return Boom.badRequest(errorMessages.unknowConnection);
      } else if (e.message === 'NotInChannel') {
        return Boom.badRequest(errorMessages.notInChannel);
      }
      request.log(['debug-error'], 'Error muting user for all: ' + e);
      return Boom.internal();
    }
  }
});
