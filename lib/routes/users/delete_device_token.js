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
      notificationService,
    } = request.services();
    const { userId } = request.auth.credentials;
    const {
      deviceToken,
    } = request.payload;
    
    try {
      await notificationService.deleteUserDeviceToken(userId, deviceToken);

      return 'ok';
    } catch (e) {
      request.log(['debug-error'], 'Error deleting device tokens: ' + e);
      return Boom.internal();
    }
  }
});
