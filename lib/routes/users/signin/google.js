'use strict';

const createSocialSigninRoute = require('./social_signin_route');

module.exports = createSocialSigninRoute({
  service: 'google',
  idExtractor: creds => creds.profile.id,
  nameExtractor: creds => creds.profile.displayName,
  additionalDataExtractor: creds => creds.profile
});
