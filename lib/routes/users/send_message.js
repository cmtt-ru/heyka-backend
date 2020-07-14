'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const Joi = require('@hapi/joi');
const errorMessages = require('../../error_messages');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/message',
  options: {
    tags: ['api', 'user'],
    description: 'Send message to user',
    validate: {
      payload: Joi.object({
        userId: Joi.string().uuid().required(),
        isResponseNeeded: Joi.bool().optional().default(false),
        message: Joi.object().required(),
        channelId: Joi.string().uuid().required(),
        workspaceId: Joi.string().uuid().required()
      })
    },
    response: {
      failAction: 'error',
      status: {
        200: Joi.object({
          messageId: Joi.string().uuid().required()
        })
      }
    }
  },
  handler: async (request, h) => {
    const { 
      userService
    } = request.services();
    const { userId: fromUserId } = request.auth.credentials;
    const {
      isResponseNeeded,
      message,
      userId: toUserId,
      workspaceId,
      channelId,
    } = request.payload;
    
    try {
      const messageId = await userService.sendMessage({
        fromUserId,
        toUserId,
        isResponseNeeded,
        message,
        workspaceId,
        channelId
      });

      return { messageId };
    } catch (e) {
      if (e.message === 'UserNotConnected') {
        return Boom.badRequest(errorMessages.userNotConnected);
      }
      request.log(['debug-error'], 'Error sending message to user: ' + e);
      return Boom.internal();
    }
  }
});
