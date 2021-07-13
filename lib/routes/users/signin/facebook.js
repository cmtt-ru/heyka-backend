'use strict';

const createSocialSigninRoute = require('./social_signin_route');

module.exports = createSocialSigninRoute({
  service: 'facebook',
  idExtractor: creds => creds.profile.id,
  nameExtractor: creds => creds.profile.displayName,
  avatarExtractor: creds => `https://graph.facebook.com/${creds.profile.id}/picture?type=large`,
});
