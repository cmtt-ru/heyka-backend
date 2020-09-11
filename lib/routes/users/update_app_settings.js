'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const schemas = require('../../schemas');
const errorMessages = require('../../error_messages');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/me/app-settings',
  options: {
    tags: ['api', 'user'],
    description: 'Update application settings for current user',
    response: {
      failAction: 'error',
      status: {
        200: schemas.userWithConfidentialData,
      }
    }
  },
  handler: async (request, h) => {
    const { 
      userService,
      displayService 
    } = request.services();
    const { userId } = request.auth.credentials;
    
    try {
      const user = await userService.updateAppSettings(userId, request.payload);

      return displayService.userWithConfidentialData(user);
    } catch (e) {
      if (e.message.includes('UserNotFound')) {
        return Boom.notFound(errorMessages.notFound);
      }
      request.log(['debug-error'], 'Error on updating app_settings for current user: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
