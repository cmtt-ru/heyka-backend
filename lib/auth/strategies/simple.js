'use strict';

const Boom = require('@hapi/boom');

module.exports = (server, options) => ({
  scheme: 'bearer-access-token',
  options: {
    allowQueryToken: false,
    validate: async (request, token, h) => {
      const { userService } = request.services();
      const tokenInfo = await userService.findAccessToken(token);
      if (!tokenInfo) {
        return { isValid: false };
      }
  
      try {
        if (!tokenInfo.expired || Date.now() > tokenInfo.expired) {
          return Boom.unauthorized('Token is expired');
        }
        
        return {
          isValid: true,
          credentials: tokenInfo
        };
      } catch (e) {
        console.log('Error on parse token credentials: ', e);
        return Boom.internal();
      }
    }
  }
});
