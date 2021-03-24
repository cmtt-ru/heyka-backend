'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const Joi = require('@hapi/joi');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/delete-device-token',
  options: {
    tags: ['api', 'user'],
    description: 'Delete device token for direct push notifications',
    validate: {
      payload: Joi.object({
        deviceToken: Joi.string().required(),
      }),
    },
  },
  handler: async (request, h) => {
    const { 
      userDatabaseService: udb,
      notificationService,
    } = request.services();
    const { userId } = request.auth.credentials;
    const {
      deviceToken,
    } = request.payload;
    
    try {
      const user = await udb.findById(userId);
      if (!user.device_tokens) {
        user.device_tokens = [];
        user.platform_endpoints = {};
      }
      let index = user.device_tokens.findIndex(token => token === deviceToken);
      if (index > -1) {
        user.device_tokens.splice(index, 1);
        const endpointArn = user.platform_endpoints[deviceToken];
        delete user.platform_endpoints[deviceToken];
        await udb.updateUser(userId, {
          device_tokens: user.device_tokens,
          platform_endpoints: user.platform_endpoints,
        });
        try {
          await notificationService.deleteDeviceEndpoint(endpointArn);
        } catch(e) {
          console.log('Ошибка при удалении endpointArn: ', endpointArn, e);
        }
      }
      return 'ok';
    } catch (e) {
      request.log(['debug-error'], 'Error deleting device tokens: ' + e);
      return Boom.internal();
    }
  }
});
