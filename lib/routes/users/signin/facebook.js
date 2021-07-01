'use strict';

const createSocialSigninRoute = require('./social_signin_route');

module.exports = createSocialSigninRoute({
  service: 'facebook',
  idExtractor: creds => creds.profile.id,
  nameExtractor: creds => creds.profile.displayName,
  avatarExtractor: creds => creds.profile.picture.data.url,
});
