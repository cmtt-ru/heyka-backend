'use strict';

const Helpers = require('../helpers');
const Joi = require('joi');

module.exports = Helpers.withDefaults({
  method: 'GET',
  path: '/long-poll',
  handler: async (request, h) => {
    const { timeout } = request.query;
    await new Promise(resolve => setTimeout(resolve, parseInt(timeout, 10)));
    const xFF = request.headers['x-forwarded-for'];
    const ip = xFF ? xFF.split(',')[0] : request.info.remoteAddress;
    return ip;
  },
  options: {
    auth: false,
    tags: ['api', 'system'],
    validate: {
      query: Joi.object({
        timeout: Joi.number().default(5000).max(30000),
      }),
    },
  }
});
