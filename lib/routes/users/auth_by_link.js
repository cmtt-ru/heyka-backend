'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const schemas = require('../../schemas');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/signin/link/{fullCode}',
  options: {
    auth: false,
    tags: ['api', 'auth'],
    description: 'Creates credential tokens by authorization link',
    response: {
      failAction: 'error',
      schema: schemas.authCredentials
    }
  },
  handler: async (request, h) => {
    const { userService } = request.services();
    const { fullCode } = request.params;
    
    try {
      const {
        isValid,
        user
      } = await userService.checkAuthLink(fullCode);

      if (!isValid) {
        return Boom.badRequest('Link is not valid');
      }

      const tokens = await userService.createTokens(user);

      return tokens;
    } catch (e) {
      request.log(['debug-error'], 'Error on authorization by link: ' + e);
      return Boom.internal();
    }
  }
});
