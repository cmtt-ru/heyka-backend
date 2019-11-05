'use strict';

const Helpers = require('../../helpers');

/* Add square brackets because of two methods for that route (see https://github.com/hapipal/discuss/issues/3) */
module.exports = [Helpers.withDefaults({
  method: ['GET', 'POST'],
  path: '/signin/slack',
  options: {
    auth: 'slack'
  },
  handler: async (request, h) => {
    const { userService, displayService } = request.services();

    if (!request.auth.isAuthenticated) {
      return `Authentication failed due to ${request.auth.error.message}`;
    }

    let user = await userService.findByExternalAuthenticatorId('slack', request.auth.credentials.user_id);
    if (!user) {
      user = await userService.signup({
        slackId: request.auth.credentials.params.user_id,
        email: request.auth.credentials.params.user.email,
        displayName: request.auth.credentials.params.user.name,
        slackToken: request.auth.credentials.token,
        slackAccessToken: request.auth.credentials.params.access_token,
        slackTokenExpiresIn: Date.now() + 3600 * 1000, // 10 minutes by default,
        slackAvatar: request.auth.credentials.params.user.image_192
      });
    }
    const tokens = await userService.createTokens(user);

    return { user: displayService.user(user, tokens) };
  }
})];
