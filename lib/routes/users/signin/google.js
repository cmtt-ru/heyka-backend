'use strict';

const Helpers = require('../../helpers');
const Boom = require('@hapi/boom');

/* Add square brackets because of two methods for that route (see https://github.com/hapipal/discuss/issues/3) */
module.exports = [Helpers.withDefaults({
  method: ['GET'],
  path: '/signin/google',
  options: {
    auth: 'google',
    tags: ['api', 'socialauth'],
    description: 
      'Call the method, redirect user with the provided url and call\
      method encore with result of google authorization.'
  },
  handler: async (request, h) => {
    const { userService, displayService } = request.services();

    if (!request.auth.isAuthenticated) {
      return Boom.unauthorized(request.auth.error.message);
    }

    try {
      let newUser = false;
      let user = await userService.findByExternalAuthenticatorId('google', request.auth.credentials.profile.id);
      if (!user) {
        newUser = true;
        user = await userService.signup({
          name: request.auth.credentials.profile.displayName,
          auth: {
            google: {
              id: request.auth.credentials.profile.id,
              ...request.auth.credentials.profile
            }
          }
        });
      }
      
      const tokens = await userService.createTokens(user);
  
      const result = {
        user: displayService.userWithConfidentialData(user),
        credentials: tokens,
        newUser
      };

      if (newUser) {
        result.predefinedData = {
          email: request.auth.credentials.profile.email,
          avatar: request.auth.credentials.profile.raw.picture
        };
      }

      return result;
    } catch (e) {
      request.log(['debug-error'], 'Error on login user by google: ' + e);
      return Boom.internal();
    }
  }
})];
