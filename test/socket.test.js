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
    await db.none('DELETE FROM auth_links');
    await db.none('DELETE FROM verification_codes');
    await db.none('DELETE FROM channels_members');
    await db.none('DELETE FROM workspaces_members');
    await db.none('DELETE FROM users');
    await db.none('DELETE FROM channels');
    await db.none('DELETE FROM workspaces');
    await db.none('DELETE FROM sessions');
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
        const awaitSuccess = awaitSocketForEvent(true, socket, eventNames.socket.authSuccess, data => {
          expect(data).includes('userId');
        });
        const awaitTransactionError = awaitSocketForEvent(false, socket, `socket-api-error-${transaction}`);
        const awaitGeneralError = awaitSocketForEvent(false, socket, `socket-api-error`);
        socket.emit(eventNames.client.auth, { token: tokens.accessToken, transaction });
        // then await first finished promise
        await Promise.race([
          awaitSuccess,
          awaitTransactionError,
          awaitGeneralError
        ]);
      });
    });
    
    describe('With an expired auth tokens', () => {
      it('should return two "error" events', async () => {
        const { userService } = server.services();
        const user = await userService.signup({ email: 'hello@world.net' });
        const tokens = await userService.createTokens(user, -2019, -2019);
        const transaction = uuid4();
        const socketError = `socket-api-error-${transaction}`;
        const awaitTransactionError = awaitSocketForEvent(true, socket, socketError);
        const awaitGeneralError = awaitSocketForEvent(true, socket, 'socket-api-error');
        socket.emit(eventNames.client.auth, { token: tokens.accessToken, transaction });
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
        socket1.emit(eventNames.client.auth, { token: tokens1.accessToken, transaction: uuid4() });
        socket2.emit(eventNames.client.auth, { token: tokens2.accessToken, transaction: uuid4() });
        socket3.emit(eventNames.client.auth, { token: tokens3.accessToken, transaction: uuid4() });
        // create workspace
        const { workspace } = await workspaceService.createWorkspace(user1, 'testWorkspace');
        // add 2nd user to workspace
        await workspaceService.addUserToWorkspace(workspace.id, user2.id, wdb.roles().user);
        // create channel
        const channel = await workspaceService.createChannel(
          workspace.id,
          user1.id,
          { name: 'testChannel', isPrivate: false }
        );
        // first and second users should receive an event about just created channel
        const eventName = eventNames.socket.channelCreated;
        const socket1ShouldBeNotified = awaitSocketForEvent(true, socket1, eventName, data => {
          expect(data.id).equals(channel.id);
          expect(data.name).equals(channel.name);
        });
        const socket2ShouldBeNotified = awaitSocketForEvent(true, socket2, eventName, data => {
          expect(data.id).equals(channel.id);
          expect(data.name).equals(channel.name);
        });
        const socket3ShouldntBeNotified = awaitSocketForEvent(false, socket3, eventName);
        /* Сложно на английском написать
        Ждём, в общем, что первый и второй сокет получат ивент о только что созданном канале
        И НЕ ждём, что третий сокет получит этот ивент.
        */
        await Promise.race([
          Promise.all([
            socket1ShouldBeNotified,
            socket2ShouldBeNotified
          ]),
          socket3ShouldntBeNotified
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
        adminSocket.emit(eventNames.client.auth, { token: tokens.accessToken, transaction: uuid4() });
        // create workspace
        const { workspace } = await workspaceService.createWorkspace(admin, 'testWorkspace');
        const notifyAboutJoinedUser = awaitSocketForEvent(true, adminSocket, eventNames.socket.userJoined, data => {
          expect(data.id).equals(user.id);
        });
        // join user by invite (without await because
        // we are awaiting the event
        workspaceService.addUserToWorkspace(workspace.id, user.id);
        await notifyAboutJoinedUser;
      });
    });
  });
  
  describe('Testing select/unselect channels', () => {
    describe('User select a public channel for the first time', () => {
      it('All workspace members should be notified. Non workspace members shoulnt be', async () => {
        const {
          userService,
          workspaceService
        } = server.services();
        const admin = await userService.signup({ email: 'admin@world.net' });
        const member = await userService.signup({ email: 'user@world.net' });
        const notMember = await userService.signup({ email: 'notmember@world.net' });
        const { workspace } = await workspaceService.createWorkspace(admin, 'test');
        await workspaceService.addUserToWorkspace(workspace.id, member.id);
        const channel = await workspaceService.createChannel(workspace.id, admin.id, {
          isPrivate: false,
          name: 'testChannel'
        });
        const adminTokens = await userService.createTokens(admin);
        const memberTokens = await userService.createTokens(member);
        const notMemberTokens = await userService.createTokens(notMember);

        // authenticate 3 users
        const adminSocket = io(server.info.uri);
        const memberSocket = io(server.info.uri);
        const notMemberSocket = io(server.info.uri);
        const awaitSuccessForSocket = (socket) => new Promise((resolve, reject) => {
          socket.on(eventNames.socket.authSuccess, data => {
            try {
              expect(data).includes('userId');
            } catch(e) {
              reject(e);
            }
            resolve();
          });
        });
        const awaitAdminAuth = awaitSuccessForSocket(adminSocket);
        const awaitMemberAuth = awaitSuccessForSocket(memberSocket);
        const awaitNotMemberAuth = awaitSuccessForSocket(notMemberSocket);
        adminSocket.emit(eventNames.client.auth, { token: adminTokens.accessToken, transaction: uuid4() });
        memberSocket.emit(eventNames.client.auth, { token: memberTokens.accessToken, transaction: uuid4() });
        notMemberSocket.emit(eventNames.client.auth, { token: notMemberTokens.accessToken, transaction: uuid4() });
        await Promise.all([awaitAdminAuth, awaitMemberAuth, awaitNotMemberAuth]);
        
        /**
         * Сейчас админ с помощью API запроса присоединится к каналу
         * Ждём, что админ и мембер получат уведомления о присоединении
         * При этом не мембер не получит
         */
        const awaitUserSelectedForSocket = (socket) => new Promise((resolve, reject) => {
          socket.on(eventNames.socket.userSelectedChannel, data => {
            try {
              expect(data).includes('userId');
              expect(data).includes('channelId');
              expect(data.channelId).equals(channel.id);
            } catch(e) {
              reject(e);
            }
            /**
             * Даём 50 мс, если за это время не мембер получит уведомление
             * о присоединии, то значит есть ошибка
             */
            setTimeout(() => resolve(), 50);
          });
        });
        const awaitNotifyForAdmin = awaitUserSelectedForSocket(adminSocket);
        const awaitNotifyForMember = awaitUserSelectedForSocket(memberSocket);
        const notAwaitUserSelected = new Promise((resolve, reject) => {
          notMemberSocket.on(eventNames.socket.userSelectedChannel, data => {
            reject('NotMember shouldb be notified!!!');
          });
        });
        await server.inject({
          method: 'GET',
          url: `/channels/${channel.id}/select`,
          headers: { Authorization: `Bearer ${adminTokens.accessToken}` }
        });
        await Promise.race([
          Promise.all([
            awaitNotifyForAdmin,
            awaitNotifyForMember
          ]),
          notAwaitUserSelected
        ]);
      });
    });
    describe('User was in a private channel, selects a publisc channel', () => {
      it('Only channel members should be notified about unselect the channel', async () => {
        const {
          userService,
          workspaceService
        } = server.services();
        const admin = await userService.signup({ email: 'admin@world.net' });
        const member = await userService.signup({ email: 'user@world.net' });
        const notMember = await userService.signup({ email: 'notmember@world.net' });
        const { workspace } = await workspaceService.createWorkspace(admin, 'test');
        await workspaceService.addUserToWorkspace(workspace.id, member.id);
        await workspaceService.addUserToWorkspace(workspace.id, notMember.id);
        const privateChannel = await workspaceService.createChannel(workspace.id, admin.id, {
          isPrivate: true,
          name: 'privateChannel'
        });
        // Добавляет member к этому каналу
        await workspaceService.addMembersToChannel(privateChannel.id, workspace.id, [ member.id ]);
        const publicChannel = await workspaceService.createChannel(workspace.id, admin.id, {
          isPrivate: false,
          name: 'publicChannel'
        });
        const adminTokens = await userService.createTokens(admin);
        const memberTokens = await userService.createTokens(member);
        const notMemberTokens = await userService.createTokens(notMember);

        // authenticate 3 users
        const adminSocket = io(server.info.uri);
        const memberSocket = io(server.info.uri);
        const notMemberSocket = io(server.info.uri);
        let eventName = eventNames.socket.authSuccess;
        const awaitAdminAuth = awaitSocketForEvent(true, adminSocket, eventName, data => {
          expect(data).includes('userId');
        });
        const awaitMemberAuth = awaitSocketForEvent(true, memberSocket, eventName, data => {
          expect(data).includes('userId');
        });
        const awaitNotMemberAuth = awaitSocketForEvent(true, notMemberSocket, eventName, data => {
          expect(data).includes('userId');
        });
        adminSocket.emit(eventNames.client.auth, { token: adminTokens.accessToken, transaction: uuid4() });
        memberSocket.emit(eventNames.client.auth, { token: memberTokens.accessToken, transaction: uuid4() });
        notMemberSocket.emit(eventNames.client.auth, { token: notMemberTokens.accessToken, transaction: uuid4() });
        await Promise.all([awaitAdminAuth, awaitMemberAuth, awaitNotMemberAuth]);
      
        // сейчас админ зайдет в приватный канал, нужно удостовериться, что только админ и
        // member узнают об этом.
        eventName = eventNames.socket.userSelectedChannel;
        let adminNotified = awaitSocketForEvent(true, adminSocket, eventName, data => {
          expect(data.channelId).equals(privateChannel.id);
          expect(data.userId).equals(admin.id);
        });
        let memberNotified = awaitSocketForEvent(true, memberSocket, eventName, data => {
          expect(data.channelId).equals(privateChannel.id);
          expect(data.userId).equals(admin.id);
        });
        let notMemberNotNotified = awaitSocketForEvent(false, notMemberSocket, eventName);
        let response = await server.inject({
          method: 'GET',
          url: `/channels/${privateChannel.id}/select`,
          headers: { Authorization: `Bearer ${adminTokens.accessToken}` }
        });
        expect(response.statusCode).equals(200);
        await Promise.race([
          Promise.all([
            adminNotified,
            memberNotified
          ]),
          notMemberNotNotified
        ]);
        
        /**
         * Сейчас админ с помощью API запроса изменит один канал на другой
         * При этом о том, что юзер покинул приватный канал должны узнать только
         * админ и мембер канала
         * А о том, что он присоединился ко всем - должны узнать все.
         */
        eventName = eventNames.socket.userUnselectedChannel;
        adminNotified = awaitSocketForEvent(true, adminSocket, eventName, data => {
          expect(data.channelId).equals(privateChannel.id);
          expect(data.userId).equals(admin.id);
        });
        memberNotified = awaitSocketForEvent(true, memberSocket, eventName, data => {
          expect(data.channelId).equals(privateChannel.id);
          expect(data.userId).equals(admin.id);
        });
        notMemberNotNotified = awaitSocketForEvent(false, notMemberSocket, eventName);
        eventName = eventNames.socket.userSelectedChannel;
        let adminNotifiedAboutSelect = awaitSocketForEvent(true, adminSocket, eventName, data => {
          expect(data.channelId).equals(publicChannel.id);
          expect(data.userId).equals(admin.id);
        });
        let memberNotifiedAboutSelect = awaitSocketForEvent(true, memberSocket, eventName, data => {
          expect(data.channelId).equals(publicChannel.id);
          expect(data.userId).equals(admin.id);
        });
        let notMemberNotifiedAboutSelect = awaitSocketForEvent(true, adminSocket, eventName, data => {
          expect(data.channelId).equals(publicChannel.id);
          expect(data.userId).equals(admin.id);
        });
        response = await server.inject({
          method: 'GET',
          url: `/channels/${publicChannel.id}/select`,
          headers: { Authorization: `Bearer ${adminTokens.accessToken}` }
        });
        expect(response.statusCode).equals(200);
        /**
         * Тут мы ждём, что админ и мембер узнают о том, что админ отконектился
         * и все люди узнают о том, что админ приконектился к публичному каналу
         * но при этом не ждём, что нот мембер узнает о дисконнекте от 
         * приватного канала.
         */
        await Promise.race([
          Promise.all([
            adminNotified,
            memberNotified,
            adminNotifiedAboutSelect,
            memberNotifiedAboutSelect,
            notMemberNotifiedAboutSelect
          ]),
          notMemberNotNotified
        ]);
      });

    });
  });
});

/**
 * Returns a promise for awaiting that specific event
 * should or should not be fired
 * @param {boolean} shouldBeFired Should the event be fired
 * @param {object} socket Socket object
 * @param {string} event Event name
 * @param {function} dataCheckFunction Function for checking data object
 * @param {number} pause Pause before resolving
 * @returns {Promise<any>} Promise for awaiting
 */
function awaitSocketForEvent(
  shouldBeFired,
  socket,
  event,
  dataCheckFunction = null,
  pause = 10,
) {
  return new Promise((resolve, reject) => {
    /**
     * Если ожидается, что событие будет вызвано
     * то ждём это событие и резолвим спустя %PAUSE%ms,
     * когда событие было вызвано, и если надо
     * чекаем дату по функции
     */
    if (shouldBeFired) {
      socket.once(event, data => {
        try {
          if (dataCheckFunction) dataCheckFunction(data);
          setTimeout(() => resolve(), pause);
        } catch(e) {
          reject(e);
        }
      });
    } else {
      /**
       * Если событие не должно быть вызвано,
       * то реджектимся, когда оно было отловлено
       */
      socket.once(event, () => {
        reject(new Error('Event shouldnt be fired'));
      });
    }
  });
}
