'use strict';

const Lab = require('@hapi/lab');
const { describe, it, before, beforeEach } = exports.lab = Lab.script();
const createServer = require('../server');
const { expect } = require('@hapi/code');
const uuid4 = require('uuid/v4');
const socketAPI = require('../lib/socket');
const io = require('socket.io-client');
const eventNames = require('../lib/socket/event_names');
const { methods: stubbedMethods } = require('./stub_external');

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
    await db.none('DELETE FROM verification_codes');
    await db.none('DELETE FROM users');
    await db.none('DELETE FROM workspaces');
    await db.none('DELETE FROM sessions');
    await db.none('DELETE FROM workspaces_members');
    await server.redis.client.flushdb();
    Object.values(stubbedMethods).forEach(m => m.reset());
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

  describe('Testing notification about just created channels', () => {
    describe('try to create channels in workspace (2 users in workspace and 1 user out of workspace)', () => {
      it('the both users should receive event, the third user shouldnt', async () => {
        const {
          userService,
          workspaceService,
          workspaceDatabaseService: wdb
        } = server.services();
        // sign up three users and create valid tokens
        const user1 = await userService.signup({ email: 'hello1@world.net' });
        const user2 = await userService.signup({ email: 'hello2@world.net' });
        const user3 = await userService.signup({ email: 'hello3@world.net' });
        const tokens1 = await userService.createTokens(user1);
        const tokens2 = await userService.createTokens(user2);
        const tokens3 = await userService.createTokens(user3);
        // authenticate 3 users
        const socket1 = io(server.info.uri);
        const socket2 = io(server.info.uri);
        const socket3 = io(server.info.uri);
        socket1.emit(eventNames.client.auth, { token: tokens1.access, transaction: uuid4() });
        socket2.emit(eventNames.client.auth, { token: tokens2.access, transaction: uuid4() });
        socket3.emit(eventNames.client.auth, { token: tokens3.access, transaction: uuid4() });
        // create workspace
        const workspace = await workspaceService.createWorkspace(user1, 'testWorkspace');
        // add 2nd user to workspace
        await workspaceService.addUserToWorkspace(workspace.id, user2.id, wdb.roles().user);
        // create channel
        const channel = await workspaceService.createChannel(
          workspace.id,
          user1.id,
          { name: 'testChannel', isPrivate: false }
        );
        // first and second users should receive an event about just created channel
        const awaitChannelCreatedEvent = (socket) => new Promise((resolve, reject) => {
          socket.on(eventNames.socket.channelCreated, data => {
            try {
              expect(data.id).equals(channel.id);
              expect(data.name).equals(channel.name);
            } catch (e) {
              reject(e);
            }
            // Таймаут нужен для того, чтобы если придет ивент
            // третьему юзеру, то мы должны получить ошибку
            // если не сделать таймаут, то третий сокет может
            // получить ивент раньше, чем получат эти два
            setTimeout(() => { resolve(); }, 10);
          });
        });
        const notAwaitEvent = (socket) => new Promise((resolve, reject) => {
          socket.on(eventNames.socket.channelCreated, data => {
            reject();
          });
        });
        /* Сложно на английском написать
        Ждём, в общем, что первый и второй сокет получат ивент о только что созданном канале
        И НЕ ждём, что третий сокет получит этот ивент.
        */
        await Promise.race([
          Promise.all([awaitChannelCreatedEvent(socket1), awaitChannelCreatedEvent(socket2)]),
          notAwaitEvent(socket3)
        ]);
      });
    });
  });

  describe('Testing notification about joined user', () => {
    describe('Add user to the workspace', () => {
      it('"user-joined" event should be emitted', async () => {
        const {
          userService,
          workspaceService
        } = server.services();
        // sign up users and create valid tokens
        const admin = await userService.signup({ email: 'admin@world.net' });
        const user = await userService.signup({ email: 'user@world.net' });
        const tokens = await userService.createTokens(admin);
        // authenticate 3 users
        const adminSocket = io(server.info.uri);
        adminSocket.emit(eventNames.client.auth, { token: tokens.access, transaction: uuid4() });
        // create workspace
        const workspace = await workspaceService.createWorkspace(admin, 'testWorkspace');
        const notifyAboutJoinedUser = new Promise((resolve, reject) => {
          adminSocket.on(eventNames.socket.userJoined, data => {
            try {
              expect(data.id).equals(user.id);
            } catch(e) {
              reject(e);
            }
            resolve();
          });
        });
        // join user by invite (without await because
        // we are awaiting the event
        workspaceService.addUserToWorkspace(workspace.id, user.id);
        await notifyAboutJoinedUser;
      });
    });
  });
});
