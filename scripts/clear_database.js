'use strict';

const createServer = require('../server');

async function clearDatabase () {
  // create server
  const server = await createServer();

  // clear all data
  const db = server.plugins['hapi-pg-promise'].db;
  await server.redis.client.flushdb();
  await db.query('DELETE FROM verification_codes');
  await db.query('DELETE FROM auth_links');
  await db.query('DELETE FROM users');
  await db.query('DELETE FROM sessions');
  await db.query('DELETE FROM channels');
  await db.query('DELETE FROM invites');
  await db.query('DELETE FROM workspaces');
  console.log('Done!');
  process.exit(0);
}

clearDatabase();
