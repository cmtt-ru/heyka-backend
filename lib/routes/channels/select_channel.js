'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');

module.exports = Helpers.withDefaults({
  method: 'GET',
  path: '/channels/{channelId}/select',
  options: {
    tags: ['api', 'channels'],
    description: 'Select a certain channel'
  },
  handler: async (request, h) => {
    const {
      channelService,
      channelDatabaseService
    } = request.services();
    const { userId } = request.auth.credentials;
    const { channelId } = request.params;
    
    try {
      const canSelect = await channelService.canSelectChannel(channelId, userId);

      if (!canSelect) {
        return Boom.forbidden('UserCanNotSelectChannel');
      }

      const token = await channelService.grantChannelTokenForUser(channelId, userId);
      await channelDatabaseService.switchUserToChannel(channelId, userId);
      

      return {
        status: 'success',
        token
      };
    } catch (e) {
      request.log(['debug-error'], 'Error on select channel by user: ' + e + e.stack);
      return Boom.internal();
    }
  }
});