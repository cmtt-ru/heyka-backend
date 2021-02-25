'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const Joi = require('@hapi/joi');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/channels/{channelId}/permissions',
  options: {
    tags: ['api', 'channels'],
    description: 'Add users to the channel',
    validate: {
      payload: Joi.object({
        userId: Joi.string().required().uuid(),
        role: Joi.string().valid('admin', 'user'),
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
    const { userId: memberId, role } = request.payload;
    const {
      channelService,
      permissionService,
    } = request.services();

    try {
      const permitted = await permissionService.canManageChannelMembers(channelId, userId);
      
      if (!permitted) {
        return Boom.forbidden();
      }

      await channelService.changeMemberRole(channelId, memberId, role);

      return 'ok';
    } catch (e) {
      if (e.message === 'LastAdminInChannel') {
        return Boom.badRequest('Last admin in channel');
      } else if (e.message === 'UserNotMember') {
        return Boom.badRequest('User is not channel member');
      }
      request.log(['debug-error'], 'Error on change member role: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
