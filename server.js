'use strict';

require('log-timestamp');
const Glue = require('@hapi/glue');
const manifest = require('./config/manifest');
const options = {
  relativeTo: __dirname
};

module.exports = async function createServer () {
  const server = await Glue.compose(manifest, options);

  //// FIX before deploy parallel nodes
  const db = server.plugins['hapi-pg-promise'].db;
  const redis = server.redis.client;
  const channels = await db.any('SELECT * FROM channels');
  await Promise.all(channels.map(ch => redis.del(`channel:janus:${ch.id}`)));
  console.log(`Delete redis janus opts for ${channels.length} channels`);

  return server;
};
