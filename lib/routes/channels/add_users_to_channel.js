'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const Joi = require('@hapi/joi');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/channels/{channelId}/add-users',
  options: {
    tags: ['api', 'channels'],
    description: 'Add users to the channel',
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
      channelDatabaseService: chdb,
    } = request.services();

    try {
      const permitted = await permissionService.canManageChannelMembers(channelId, userId);
      
      if (!permitted) {
        return Boom.forbidden();
      }

      const channel = await chdb.getChannelById(channelId);

      await workspaceService.addMembersToChannel(channelId, channel.workspace_id, users);

      return 'ok';
    } catch (e) {
      request.log(['debug-error'], 'Error on add member to channel: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
