'use strict';

const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');
const Helpers = require('../helpers');
const fs = require('fs');
const path = require('path');
const speedTestFile = fs.readFileSync(path.join(__dirname, 'speed_test_data'));

module.exports = Helpers.withDefaults({
  method: 'GET',
  path: '/speedtest',
  options: {
    plugins: {
      'hapi-rate-limit': {
        pathLimit: 50
      }
    },
    auth: false,
    response: {
      status: {
        429: Joi.any().example(Boom.tooManyRequests('Rate limit exceeded')).description('Too Many Requests')
      },
      failAction: 'error',
    }
  },
  handler: async (request, h) => { 
    return speedTestFile;
  },
});
