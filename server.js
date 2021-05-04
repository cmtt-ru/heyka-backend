'use strict';

require('log-timestamp');
const Glue = require('@hapi/glue');
const manifest = require('./config/manifest');
const options = {
  relativeTo: __dirname
};

module.exports = async function createServer () {
  const server = await Glue.compose(manifest, options);
  return server;
};
