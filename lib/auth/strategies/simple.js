'use strict';

const Boom = require('@hapi/boom');

module.exports = (server, options) => ({
  scheme: 'bearer-access-token',
  options: {
    allowQueryToken: false,
    validate: async (request, token, h) => {
      const tokenString = await request.redis.client.get(`token:${token}`);
      if (!tokenString) {
        return { isValid: false };
      }
  
      try {
        const credentials = JSON.parse(tokenString);
  
        if (!credentials.expiredTime || Date.now() > credentials.expiredTime) {
          return Boom.unauthorized('Token is expired');
        }
        
        return {
          isValid: true,
          credentials
        };
      } catch (e) {
        console.log('Error on parse token credentials: ', e)
        return Boom.internal();
      }
    }
  }
});
