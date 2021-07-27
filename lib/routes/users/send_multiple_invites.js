'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const Joi = require('@hapi/joi');

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
      failAction: 'log',
      status: {
        200: Joi.object({
          invites: Joi.array().items(Joi.object({
            status: Joi.allow('ok', 'error').required(),
            userId: Joi.string().uuid().required(),
            invite: Joi.string().optional(),
          })),
        }),
      },
    },
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
      const uniqueUsers = users.filter((val, i, self) => self.indexOf(val) === i);

      const invites = await Promise.allSettled(
        uniqueUsers.map(toUserId => userService.sendInvite({
          fromUserId,
          toUserId,
          isResponseNeeded,
          message,
          workspaceId,
          channelId
        }))
      );

      return {
        invites: uniqueUsers.map((userId, index) => ({
          userId,
          status: invites[index].status === 'fulfilled' ? 'ok' : 'error',
          invite: invites[index].value,
        }))
      };
    } catch (e) {
      request.log(['debug-error'], 'Error sending invite to users: ');
      request.log(['debug-error'], e);
      return Boom.internal();
    }
  }
});
