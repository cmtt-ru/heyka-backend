'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const schemas = require('../../schemas');
const errorMessages = require('../../error_messages');
const Joi = require('@hapi/joi');

module.exports = Helpers.withDefaults({
  method: 'GET',
  path: '/me',
  options: {
    tags: ['api', 'user'],
    description: 'Get authenticated user',
    response: {
      failAction: 'log',
      status: {
        200: schemas.userWithConfidentialData,
        404: Joi.any().example(Boom.notFound(errorMessages.notFound).output.payload)
          .description('User not found')
      }
    }
  },
  handler: async (request, h) => {
    const { 
      userDatabaseService: udb,
      displayService 
    } = request.services();
    const { userId } = request.auth.credentials;
    
    try {
      const user = await udb.findById(userId);

      if (!user) {
        return Boom.notFound(errorMessages.notFound);
      }

      return displayService.userWithConfidentialData(user);
    } catch (e) {
      request.log(['debug-error'], 'Error on getting current user: ' + e);
      return Boom.internal();
    }
  }
});
