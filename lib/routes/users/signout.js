'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/signout',
  options: {
    tags: ['api', 'auth'],
    description: 'Sign out current user',
  },
  handler: async (request, h) => {
    const { credentials } = request.auth;
    const { userService } = request.services();
    
    try {
      await userService.signout(credentials.userId, credentials.accessToken);

      return 'ok';
    } catch (e) {
      request.log(['debug-error'], 'Error on sign out user: ', e);
      return Boom.internal();
    }
  }
});
