'use strict';

const Boom = require('@hapi/boom');

module.exports = (server, options) => ({
  scheme: 'bearer-access-token',
  options: {
    allowQueryToken: false,
    validate: async (request, token, h) => {
      const { userService } = request.services();
      const tokenValidation = await userService.isTokenValid(token);
      
      // Token doesnt exist
      if (!tokenValidation.result && tokenValidation.cause === 'NotFound') {
        return { isValid: false };

      // Token is expired
      } else if (!tokenValidation.result && tokenValidation.cause === 'Expired') {
        throw Boom.unauthorized('Token is expired');

      // Token is found
      } else if (tokenValidation.result) {
        return {
          isValid: true,
          credentials: tokenValidation.tokenInfo
        };

      // Impossible situation
      } else {
        server.log(['error', 'warn'], 'Error on token validation');
        return Boom.internal();
      }
    }
  }
});
