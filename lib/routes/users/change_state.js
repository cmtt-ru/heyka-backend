'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const schemas = require('../../schemas');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/user/state',
  options: {
    tags: ['api', 'users'],
    description: 'Change state of the user',
    validate: {
      payload: schemas.userState
    }
  },
  handler: async (request, h) => {
    const {
      channelService,
      channelDatabaseService: chdb
    } = request.services();
    const { userId } = request.auth.credentials;
    const channelId = await chdb.getChannelByUserId(userId);

    
    try {
      const canSelect = await channelService.canSelectChannel(channelId, userId);

      if (!canSelect) {
        return Boom.forbidden('UserCanNotSelectChannel');
      }

      await channelService.selectChannel(channelId, userId);

      return 'ok';
    } catch (e) {
      request.log(['debug-error'], 'Error on select channel by user: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
