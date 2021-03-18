'use strict';

const Helpers = require('../helpers');
const Joi = require('joi');
const { mailchimp } = require('../../../config').credentials;
const {
  deleteMember,
} = require('../helpers/mailchimp');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/subscription/remove',
  options: {
    auth: false,
    tags: ['api', 'subscription'],
    validate: {
      payload: Joi.object({
        email: Joi.string().required().email(),
      })
    },
  },
  handler: async (request, h) => {
    const { email } = request.payload;
    await deleteMember(mailchimp.audienceId, email);
    
    return 'ok';
  },
});