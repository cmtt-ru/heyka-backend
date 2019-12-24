'use strict';

const Lab = require('@hapi/lab');
const { describe, it, before, beforeEach } = exports.lab = Lab.script();
const createServer = require('../server');
const { expect } = require('@hapi/code');
const uuid4 = require('uuid/v4');
const socketAPI = require('../lib/socket');
const io = require('socket.io-client');
const eventNames = require('../lib/socket/event_names');

describe('Test socket', () => {
  let server = null;
  let socketIO = null;
  let socket = null;

  before(async () => {
    server = await createServer();
    socketIO = await socketAPI.getSocketIO(server);
    socketIO.attach(server.listener);
    server.start();
    socket = io(`${server.info.uri}`);
    await new Promise(resolve => {
      socket.on('connect', () => {
        resolve();
      });
    });
  });

  beforeEach(async () => {
    const db = server.plugins['hapi-pg-promise'].db;
    await db.none('DELETE FROM users');
    await db.none('DELETE FROM workspaces');
    await db.none('DELETE FROM sessions');
    await db.none('DELETE FROM workspaces_members');
    await server.redis.client.flushdb();
  });

  describe('Testing socket authentication', () => {
    describe('With valid auth tokens', () => {
      it('server should emit "auth-success" event', async () => {
        const { userService } = server.services();
        // sign up user and create valid tokens
        const user = await userService.signup({ email: 'hello@world.net' });
        const tokens = await userService.createTokens(user);
        const transaction = uuid4();
        const awaitSuccess = new Promise((resolve, reject) => {
          socket.on(eventNames.socket.authSuccess, data => {
            try {
              expect(data).includes('userId');
            } catch(e) {
              reject(e);
            }
            resolve();
          });
        });
        const awaitTransactionError = new Promise((resolve, reject) => {
          socket.on(`socket-api-error-${transaction}`, reject);
        });
        const awaitGeneralError = new Promise((resolve, reject) => {
          socket.on('socket-api-error', reject);
        });
        socket.emit(eventNames.client.auth, { token: tokens.access, transaction });
        // then await first finished promise
        await Promise.race([awaitSuccess, awaitTransactionError, awaitGeneralError]);
      });
    });
    
    describe('With an expired auth tokens', () => {
      it('should return two "error" events', async () => {
        const { userService } = server.services();
        const user = await userService.signup({ email: 'hello@world.net' });
        const tokens = await userService.createTokens(user, -2019, -2019);
        const transaction = uuid4();
        const awaitTransactionError = new Promise((resolve) => {
          socket.on(`socket-api-error-${transaction}`, resolve);
        });
        const awaitGeneralError = new Promise((resolve) => {
          socket.on('socket-api-error', resolve);
        });
        socket.emit(eventNames.client.auth, { token: tokens.access, transaction });
        // the both errors should be fired
        await Promise.all([awaitTransactionError, awaitGeneralError]);
      });
    });
  });
});
