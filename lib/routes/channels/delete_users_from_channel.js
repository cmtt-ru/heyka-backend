'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const Joi = require('@hapi/joi');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/channels/{channelId}/delete-users',
  options: {
    tags: ['api', 'channels'],
    description: 'Delete users from the channel',
    validate: {
      payload: Joi.object({
        users: Joi.array().items(Joi.string().required().uuid()),
      }),
      params: Joi.object({
        channelId: Joi.string().uuid().required(),
      }),
    },
    response: {
      status: {
        200: Joi.allow('ok'),
        403: Joi.any()
          .description('User can not manage member list'),
      }
    }
  },
  handler: async (request, h) => {
    const { userId } = request.auth.credentials;
    const { channelId } = request.params;
    const { users } = request.payload;
    const {
      workspaceService,
      permissionService,
    } = request.services();

    try {
      const permitted = await permissionService.canManageChannelMembers(channelId, userId);
      
      if (!permitted) {
        return Boom.forbidden();
      }

      await Promise.all(users.map(uId => workspaceService.kickUserFromChannel(channelId, uId)));

      return 'ok';
    } catch (e) {
      request.log(['debug-error'], 'Error on add member to channel: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
