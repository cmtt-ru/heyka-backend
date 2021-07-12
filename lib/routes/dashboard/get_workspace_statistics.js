'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const Joi = require('@hapi/joi');
const errorMessages = require('../../error_messages');

module.exports = Helpers.withDefaults({
  method: 'GET',
  path: '/statistics/workspace',
  options: {
    tags: ['api', 'dashboard'],
    description: 'Get average and median count of channels in workspace',
    response: {
      status: {
        200: Joi.object({
          average: Joi.number(),
          median: Joi.number().integer().min(0),
        }).label('Workspace statistics details'),
        403: Joi.any().example(Boom.forbidden(errorMessages.accessDenied).output.payload)
          .description('User hasn\'t access to the statistics')
      },
      failAction: 'error',
    }
  },
  handler: async (request, h) => {
    const {
      channelDatabaseService: chdb,
    } = request.services();

    const average = (nums) => {
      return +(nums.reduce((a, b) => (a + b)) / nums.length).toFixed(2);
    };

    const median = (nums) => {
      nums.sort((a, b) => (a - b) );

      const i = nums.length / 2;

      return i % 1 === 0 ? (nums[i - 1] + nums[i]) / 2 : nums[Math.floor(i)];
    };

    try {
      const countsChannelsInWorkspace = await chdb.getCountsChannelsInWorkspace();

      return {
        average: average(countsChannelsInWorkspace),
        median: median(countsChannelsInWorkspace)
      };
    } catch (e) {
      request.log(['debug-error'], 'Error on get workspace statistics: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
