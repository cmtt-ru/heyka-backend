'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const Joi = require('@hapi/joi');
const schemas = require('../../schemas');
const errorMessages = require('../../error_messages');

module.exports = Helpers.withDefaults({
  method: 'GET',
  path: '/channels/{channelId}/members',
  options: {
    tags: ['api', 'channels'],
    description: 'Get channel members',
    response: {
      status: {
        200: Joi.array().items(schemas.channelMemberInfo),
        403: Joi.any().example(Boom.forbidden(errorMessages.accessDenied).output.payload)
          .description('User hasn\'t access to the channel')
      },
      failAction: 'error',
    }
  },
  handler: async (request, h) => {
    const {
      channelDatabaseService: chdb,
      displayService,
      permissionService
    } = request.services();
    const { userId } = request.auth.credentials;
    const { channelId } = request.params;
    
    try {
      const canSelect = await permissionService.canViewChannelInfo(channelId, userId);

      if (!canSelect) {
        return Boom.forbidden(errorMessages.accessDenied);
      }

      const channelMembers = await chdb.getChannelMembersWithWorkspaceRoles(channelId);
      return channelMembers.map(u => displayService.channelMemberInfo(u));
    } catch (e) {
      request.log(['debug-error'], 'Error on get channel members: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
