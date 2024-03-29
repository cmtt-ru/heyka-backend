'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const errorMessages = require('../../error_messages');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/me/delete',
  options: {
    tags: ['api', 'user'],
    description: 'Delete account',
  },
  handler: async (request, h) => {
    const { 
      userService,
    } = request.services();
    const { userId } = request.auth.credentials;
    
    try {
      await userService.deleteAccount(userId);

      return 'ok';
    } catch (e) {
      if (e.message.includes('InvalidPassword')) {
        return Boom.forbidden(errorMessages.invalidPassword);
      } else if (e.message.includes('NotFound')) {
        return Boom.notFound();
      } else if (e.message.includes('AdminCannotBeDeleted')) {
        return Boom.badRequest(errorMessages.cannotDeleteAdminUser);
      }
      request.log(['debug-error'], 'Error on deleting current user: ' + e);
      return Boom.internal();
    }
  }
});
