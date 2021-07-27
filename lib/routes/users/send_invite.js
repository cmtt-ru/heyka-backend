'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const Joi = require('@hapi/joi');
const errorMessages = require('../../error_messages');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/send-invite',
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
      failAction: 'log',
      status: {
        200: Joi.object({
          inviteId: Joi.string().uuid().required()
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
      const inviteId = await userService.sendInvite({
        fromUserId,
        toUserId,
        isResponseNeeded,
        message,
        workspaceId,
        channelId
      });

      return { inviteId };
    } catch (e) {
      if (e.message === 'UserNotConnected') {
        return Boom.badRequest(errorMessages.userNotConnected);
      } else if (e.message === 'UserNotFound') {
        return Boom.notFound('User not found');
      }
      request.log(['debug-error'], 'Error sending invite to user: ' + e);
      return Boom.internal();
    }
  }
});
