'use strict';

const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');
const Helpers = require('../helpers');
const { mailchimp } = require('../../../config').credentials;
const {
  totalAudienceCount,
} = require('../helpers/mailchimp');

module.exports = Helpers.withDefaults({
  method: 'GET',
  path: '/subscription/count',
  options: {
    plugins: {
      'hapi-rate-limit': {
        pathLimit: 50
      }
    },
    auth: false,
    tags: ['api', 'subscription'],
    description: 'Total subscribers count',
    response: {
      status: {
        429: Joi.any().example(Boom.tooManyRequests('Rate limit exceeded')).description('Too Many Requests')
      },
      failAction: 'log',
    }
  },
  handler: async (request, h) => {
    const count = await totalAudienceCount(mailchimp.audienceId);
  
    return count;
  },
});
