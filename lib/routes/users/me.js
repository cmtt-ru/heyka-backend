'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const schemas = require('../../schemas');

module.exports = Helpers.withDefaults({
  method: 'GET',
  path: '/me',
  options: {
    tags: ['api', 'user'],
    description: 'Get authenticated user',
    response: {
      failAction: 'error',
      schema: schemas.user
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

      return displayService.user(user);
    } catch (e) {
      request.log(['debug-error'], 'Error on getting current user: ' + e);
      return Boom.internal();
    }
  }
});
