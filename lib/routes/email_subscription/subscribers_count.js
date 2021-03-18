'use strict';

const Helpers = require('../helpers');
const { mailchimp } = require('../../../config').credentials;
const {
  totalAudienceCount,
} = require('../helpers/mailchimp');

module.exports = Helpers.withDefaults({
  method: 'GET',
  path: '/subscription/count',
  options: {
    auth: false,
    tags: ['api', 'subscription'],
  },
  handler: async (request, h) => {
    const count = await totalAudienceCount(mailchimp.audienceId);
  
    return count;
  },
});
