'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const Joi = require('@hapi/joi');
const errorMessages = require('../../../lib/error_messages');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/send-invite/slack',
  options: {
    tags: ['api', 'user'],
    description: 'Send message to user using slack',
    validate: {
      payload: Joi.object({
        userId: Joi.string().uuid().required(),
        channelId: Joi.string().uuid().required(),
        workspaceId: Joi.string().uuid().required()
      })
    },
  },
  handler: async (request, h) => {
    const { 
      userService
    } = request.services();
    const { userId: fromUserId } = request.auth.credentials;
    const {
      userId: toUserId,
      workspaceId,
      channelId,
    } = request.payload;
    
    try {
      await userService.sendInviteBySlack({
        fromUserId,
        toUserId,
        workspaceId,
        channelId
      });

      return 'ok';
    } catch (e) {
      if (e.message === 'UserNotFound') {
        return Boom.notFound('User not found');
      }
      else if (e.message === 'UserNotConnectedSlack') {
        return Boom.badRequest('User not connected slack');
      }
      else if (e.message === 'WorkspaceNotConnectedSlack') {
        return Boom.badRequest('Workspace not connected slack');
      }
      else if (e.message === 'There are no members in the workspace') {
        return Boom.notFound(errorMessages.membersNotFound);
      }
      else if (e.message === 'Too many members in the channel') {
        return Boom.badRequest(errorMessages.limitExceeded);
      }
      request.log(['debug-error'], 'Error sending invite to user using slack: ' + e);
      return Boom.internal();
    }
  }
});
