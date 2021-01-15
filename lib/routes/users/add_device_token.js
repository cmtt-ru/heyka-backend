'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const Joi = require('@hapi/joi');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/add-device-token',
  options: {
    tags: ['api', 'user'],
    description: 'Add device token for direct push notifications',
    validate: {
      payload: Joi.object({
        deviceToken: Joi.string().required(),
        platform: Joi.string().required().valid('iOS', 'Android'),
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
      platform,
    } = request.payload;
    
    try {
      const user = await udb.findById(userId);
      if (!user.device_tokens) {
        user.device_tokens = [];
        user.platform_endpoints = {};
      }
      if (!user.device_tokens.includes(deviceToken)) {
        const endpoint = await notificationService.createDeviceEndpoint(platform, deviceToken);
        user.device_tokens.push(deviceToken);
        user.platform_endpoints = { ...user.platform_endpoints, [deviceToken]: endpoint };
        await udb.updateUser(userId, {
          device_tokens: user.device_tokens,
          platform_endpoints: user.platform_endpoints,
        });
      }
      return 'ok';
    } catch (e) {
      request.log(['debug-error'], 'Error adding device tokens: ' + e);
      return Boom.internal();
    }
  }
});
