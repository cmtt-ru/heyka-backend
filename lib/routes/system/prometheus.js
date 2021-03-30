'use strict';

const Helpers = require('../helpers');
const { getAppMetrics } = require('../../../monitoring');

module.exports = Helpers.withDefaults({
  method: 'GET',
  path: '/prometheus',
  handler: async (request, h) => {
    return getAppMetrics();
  },
  options: {
    auth: false,
    tags: ['api']
  }
});
