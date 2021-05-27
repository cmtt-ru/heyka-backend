'use strict';

const Helpers = require('../helpers');
const Joi = require('@hapi/joi');
const { mailchimp } = require('../../../config').credentials;
const {
  addMember,
} = require('../helpers/mailchimp');
const Boom = require('@hapi/boom');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/subscription/add',
  options: {
    auth: false,
    tags: ['api', 'subscription'],
    description: 'Add email in release news list',
    validate: {
      payload: Joi.object({
        email: Joi.string().required().email(),
      })
    },
  },
  handler: async (request, h) => {
    const { email } = request.payload;
    try {
      await addMember(mailchimp.audienceId, email);
    } catch(e) {
      if (e.message === 'Bad Request') {
        const reason = JSON.parse(e.response.text);
        return Boom.badRequest(reason.detail || 'Invalid email address');
      }
      return Boom.internal();
    }
    
    return 'ok';
  },
});
