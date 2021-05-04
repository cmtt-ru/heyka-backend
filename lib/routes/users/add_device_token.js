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
      userService,
    } = request.services();
    const { userId } = request.auth.credentials;
    const {
      deviceToken,
      platform,
    } = request.payload;
    
    try {
      await userService.addUserDeviceToken(userId, deviceToken, platform);
      return 'ok';
    } catch (e) {
      request.log(['debug-error'], 'Error adding device tokens: ' + e);
      return Boom.internal();
    }
  }
});
