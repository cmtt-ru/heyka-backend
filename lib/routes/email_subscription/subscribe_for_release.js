'use strict';

const Helpers = require('../helpers');
const Joi = require('joi');
const { mailchimp } = require('../../../config').credentials;
const {
  addMember,
} = require('../helpers/mailchimp');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/subscription/add',
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
    await addMember(mailchimp.audienceId, email);
    
    return 'ok';
  },
});
