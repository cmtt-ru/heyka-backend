'use strict';

const Helpers = require('../helpers');
const Joi = require('@hapi/joi');
//const Boom = require('@hapi/boom');
const { mailchimp } = require('../../../config').credentials;
const {
  deleteMember,
} = require('../helpers/mailchimp');
//const config = require('../../../config');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/subscription/remove',
  options: {
    // plugins: {
    //   'hapi-rate-limit': {
    //     pathLimit: config.pathLimit
    //   }
    // },
    auth: false,
    tags: ['api', 'subscription'],
    description: 'Remove email from release news list',
    validate: {
      payload: Joi.object({
        email: Joi.string().required().email(),
      })
    },
    response: {
      status: {
        // 429: Joi.any().example(Boom.tooManyRequests('Rate limit exceeded')).description('Too Many Requests')
      },
      failAction: 'error',
    }
  },
  handler: async (request, h) => {
    const { email } = request.payload;
    await deleteMember(mailchimp.audienceId, email);
    
    return 'ok';
  },
});
