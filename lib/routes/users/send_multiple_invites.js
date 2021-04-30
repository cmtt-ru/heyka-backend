'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const Joi = require('@hapi/joi');
const errorMessages = require('../../error_messages');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/send-invites',
  options: {
    tags: ['api', 'user'],
    description: 'Send message to multiple users',
    validate: {
      payload: Joi.object({
        users: Joi.array().items(Joi.string().uuid().required()),
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
          invites: Joi.array().items(Joi.string().uuid().required())
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
      users,
      workspaceId,
      channelId,
    } = request.payload;
    
    try {
      const invites = await Promise.all([
        users.map(toUserId => {
          userService.sendInvite({
            fromUserId,
            toUserId,
            isResponseNeeded,
            message,
            workspaceId,
            channelId
          });
        })
      ]);

      return { invites };
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
