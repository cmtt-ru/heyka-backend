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
  // sync janus with redis
  const { janusWorkspaceService } = server.services();

  const db = server.plugins['hapi-pg-promise'].db;

  const redis = server.redis.client;

  const channels = await db.any('SELECT * FROM channels');


  await Promise.all(channels.map(async ch => {
    let janusOpts4Channel = await redis.get(`channel:janus:${ch.id}`);

    if (!janusOpts4Channel) return;

    janusOpts4Channel = JSON.parse(janusOpts4Channel);

    await janusWorkspaceService.addAuthTokenForWorkspace(ch.id, janusOpts4Channel);

    janusOpts4Channel.authToken = ch.id;

    const roomExists = await janusWorkspaceService.roomExists(ch.janus, janusOpts4Channel);


    await janusWorkspaceService.deleteAuthTokenForWorkspace(ch.id, janusOpts4Channel);

    if (!roomExists) {
      console.log(`del redis janus opts for ${ch.name} (${ch.id}`);
      await redis.del(`channel:janus:${ch.id}`);
    }
  }));
  /*----------*/

  return server;
};
