'use strict';

const Helpers = require('../helpers');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/workspaces/{workspaceId}/channels',
  options: {
    tags: ['api', 'workspaces'],
    description: 'Creating channels in a certain workspace',
    validate: {
      payload: Joi.object({
        name: Joi.string().required().min(3).max(100),
        isPrivate: Joi.boolean().optional().default(false),
        lifespan: Joi
          .number()
          .optional()
          .default(0)
          .description('Is channel temporary? Lifespan in milliseconds')
      }).description('New channel info').label('CreatingChannelInfo')
    }
  },
  handler: async (request, h) => {
    const { workspaceService, displayService } = request.services();
    const { userId } = request.auth.credentials;
    const { workspaceId } = request.params;
    
    try {
      const canCreateChannel = await workspaceService.canCreateChannel(workspaceId, userId);
      if (!canCreateChannel) {
        return Boom.unauthorized('UserCanNotCreateChannels');
      }

      const channel = await workspaceService.createChannel(workspaceId, userId, request.payload);

      return {
        channel: displayService.channel(channel)
      };
    } catch (e) {
      request.log(['debug-error'], 'Error create channel: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
