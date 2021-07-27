'use strict';

// const Joi = require('@hapi/joi');
// const Boom = require('@hapi/boom');
const Helpers = require('../helpers');
const fs = require('fs');
const path = require('path');
const speedTestFile = fs.readFileSync(path.join(__dirname, 'speed_test_data'));
//const config = require('../../../config');

module.exports = Helpers.withDefaults({
  method: 'GET',
  path: '/speedtest',
  options: {
    // plugins: {
    //   'hapi-rate-limit': {
    //     pathLimit: config.pathLimit
    //   }
    // },
    auth: false,
    response: {
      status: {
        // 429: Joi.any().example(Boom.tooManyRequests('Rate limit exceeded')).description('Too Many Requests')
      },
      failAction: 'error',
    }
  },
  handler: async (request, h) => { 
    return speedTestFile;
  },
});
