'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const Joi = require('@hapi/joi');
const errorMessages = require('../../error_messages');

module.exports = Helpers.withDefaults({
  method: 'DELETE',
  path: '/channels/{channelId}/invites',
  options: {
    tags: ['api', 'channels'],
    description: 'Delete all invites to the channel',
    validate: {
      query: Joi.object({
        revokeAccess: Joi.boolean().default(false),
      }),
    },
    response: {
      status: {
        200: Joi.valid('ok'),
      },
      failAction: 'error',
    }
  },
  handler: async (request, h) => {
    const {
      channelService,
      permissionService
    } = request.services();
    const { userId } = request.auth.credentials;
    const { channelId } = request.params;
    const { revokeAccess } = request.query;

    try {
      const canDeleteAllInvites = await permissionService.canDeleteAllInvitesChannel(channelId, userId);
      if (!canDeleteAllInvites) {
        return Boom.forbidden(errorMessages.accessDenied);
      }

      await channelService.deleteAllInvites(channelId, revokeAccess);

      return 'ok';
    } catch (e) {
      if (e.message === 'ChannelNotFound') {
        return Boom.notFound(errorMessages.notFound);
      }
      request.log(['debug-error'], 'Error on deleting all invites to the channel: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
