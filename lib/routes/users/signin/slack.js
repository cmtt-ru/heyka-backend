'use strict';

const createSocialSigninRoute = require('./social_signin_route');

module.exports = createSocialSigninRoute({
  service: 'slack',
  idExtractor: creds => creds.params.user_id,
  nameExtractor: creds => creds.params.user.name,
  avatarExtractor: creds => creds.params.user.image_1024,
});
