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
      }),
    },
  },
  handler: async (request, h) => {
    const { 
      userDatabaseService: udb,
    } = request.services();
    const { userId } = request.auth.credentials;
    const {
      deviceToken,
    } = request.payload;
    
    try {
      const user = await udb.findById(userId);
      if (!user.device_tokens) {
        user.device_tokens = [];
      }
      if (!user.device_tokens.includes(deviceToken)) {
        user.device_tokens.push(deviceToken);
        await udb.updateUser(userId, {
          device_tokens: user.device_tokens 
        });
      }
      return 'ok';
    } catch (e) {
      request.log(['debug-error'], 'Error adding device tokens: ' + e);
      return Boom.internal();
    }
  }
});
