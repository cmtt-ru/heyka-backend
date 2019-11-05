'use strict';

const Helpers = require('../../helpers');

/* Add square brackets because of two methods for that route (see https://github.com/hapipal/discuss/issues/3) */
module.exports = [Helpers.withDefaults({
  method: ['GET', 'POST'],
  path: '/signin/google',
  options: {
    auth: 'google'
  },
  handler: async (request, h) => {
    const { userService, displayService } = request.services();

    if (!request.auth.isAuthenticated) {
      return `Authentication failed due to ${request.auth.error.message}`;
    }

    let user = await userService.findByExternalAuthenticatorId('google', request.auth.credentials.profile.id);
    if (!user) {
      user = await userService.signup({
        googleId: request.auth.credentials.profile.id,
        email: request.auth.credentials.profile.email,
        displayName: request.auth.credentials.profile.displayName, // first name + last name
        googleToken: request.auth.credentials.token,
        googleTokenExpiresIn: Date.now() + request.auth.credentials.expiresIn * 1000, // in milliseconds,
        googleAvatar: request.auth.credentials.profile.raw.picture
      });
    }
    
    const tokens = await userService.createTokens(user);

    return {
      user: displayService.user(user, tokens)
    };
  }
})];
