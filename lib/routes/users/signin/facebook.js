'use strict';

const Helpers = require('../../helpers');

/* Add square brackets because of two methods for that route (see https://github.com/hapipal/discuss/issues/3) */
module.exports = [Helpers.withDefaults({
  method: ['GET', 'POST'],
  path: '/signin/facebook',
  options: {
    auth: 'facebook'
  },
  handler: async (request, h) => {
    const { userService, displayService } = request.services();

    if (!request.auth.isAuthenticated) {
      return `Authentication failed due to ${request.auth.error.message}`;
    }

    let user = await userService.findByExternalAuthenticatorId('facebook', request.auth.credentials.profile.id);
    if (!user) {
      try {
        user = await userService.signup({
          email: request.auth.credentials.profile.email,
          auth: {
            facebook: {
              id: request.auth.credentials.profile.id,
              ...request.auth.credentials
            }
          }
        });
      } catch (e) {
        request.log(['error'], e);
      }

    }
    
    const tokens = await userService.createTokens(user);

    return {
      user: displayService.user(user, tokens)
    };
  }
})];
