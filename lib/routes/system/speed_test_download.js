'use strict';

const Helpers = require('../helpers');
const fs = require('fs');
const path = require('path');
const speedTestFile = fs.readFileSync(path.join(__dirname, 'speed_test_data'));

module.exports = Helpers.withDefaults({
  method: 'GET',
  path: '/speedtest',
  options: {
    auth: false,
  },
  handler: async (request, h) => { 
    return speedTestFile;
  },
});
