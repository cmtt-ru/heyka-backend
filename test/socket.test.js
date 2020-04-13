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
const helpers = require('./helpers');
const schemas = require('../lib/schemas');

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
        const { userService, workspaceService } = server.services();
        // sign up user and create valid tokens
        const user = await userService.signup({ email: 'hello@world.net' });
        const tokens = await userService.createTokens(user);
        const { workspace } = await workspaceService.createWorkspace(user, 'name');
        const transaction = uuid4();
        const awaitSuccess = awaitSocketForEvent(true, socket, eventNames.socket.authSuccess, data => {
          expect(data).includes('userId');
        });
        const awaitTransactionError = awaitSocketForEvent(false, socket, `socket-api-error-${transaction}`);
        const awaitGeneralError = awaitSocketForEvent(false, socket, `socket-api-error`);
        socket.emit(eventNames.client.auth, {
          token: tokens.accessToken,
          transaction,
          workspaceId: workspace.id
        });
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
        const { userService, workspaceService } = server.services();
        const user = await userService.signup({ email: 'hello@world.net' });
        const tokens = await userService.createTokens(user, -2019, -2019);
        const { workspace } = await workspaceService.createWorkspace(user, 'name');
        const transaction = uuid4();
        const socketError = `socket-api-error-${transaction}`;
        const awaitTransactionError = awaitSocketForEvent(true, socket, socketError);
        const awaitGeneralError = awaitSocketForEvent(true, socket, 'socket-api-error');
        socket.emit(eventNames.client.auth, {
          token: tokens.accessToken,
          transaction,
          workspaceId: workspace.id
        });
        // the both errors should be fired
        await Promise.all([awaitTransactionError, awaitGeneralError]);
      });
    });

    describe('User tries to connect and to listen workspace without grants', () => {
      it('should return error event', async () => {
        const { userService, workspaceService } = server.services();
        // sign up user and create valid tokens
        const user = await userService.signup({ email: 'hello@world.net' });
        const user2 = await userService.signup({ email: 'hello2@world.net' });
        const tokens = await userService.createTokens(user);
        const { workspace: workspace2 } = await workspaceService.createWorkspace(user2, 'name2');
        const transaction = uuid4();
        const awaitTransactionError = awaitSocketForEvent(true, socket, `socket-api-error-${transaction}`, data => {
          expect(data.message).equals(`Can't listen workspace events`);
        });
        socket.emit(eventNames.client.auth, {
          token: tokens.accessToken,
          transaction,
          workspaceId: workspace2.id
        });
        await awaitTransactionError;
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
        // create workspace
        const { workspace } = await workspaceService.createWorkspace(user1, 'testWorkspace');
        const { workspace: w2 } = await workspaceService.createWorkspace(user3, 'name');
        // add 2nd user to workspace
        await workspaceService.addUserToWorkspace(workspace.id, user2.id, wdb.roles().user);

        // authenticate 3 users
        const socket1 = io(server.info.uri);
        const socket2 = io(server.info.uri);
        const socket3 = io(server.info.uri);
        const successAuthForAllSockets = [socket1, socket2, socket3]
          .map(socket => awaitSocketForEvent(true, socket, eventNames.socket.authSuccess));
        socket1.emit(eventNames.client.auth, {
          token: tokens1.accessToken,
          transaction: uuid4(),
          workspaceId: workspace.id
        });
        socket2.emit(eventNames.client.auth, {
          token: tokens2.accessToken,
          transaction: uuid4(),
          workspaceId: workspace.id
        });
        socket3.emit(eventNames.client.auth, {
          token: tokens3.accessToken,
          transaction: uuid4(),
          workspaceId: w2.id
        });
        await Promise.all(successAuthForAllSockets);

        // first and second users should receive an event about just created channel
        const eventName = eventNames.socket.channelCreated;
        // create channel
        const channel = await workspaceService.createChannel(
          workspace.id,
          user1.id,
          { name: 'testChannel', isPrivate: false }
        );

        const socket1ShouldBeNotified = awaitSocketForEvent(true, socket1, eventName, data => {
          expect(data.channelId).equals(channel.id);
        });
        const socket2ShouldBeNotified = awaitSocketForEvent(true, socket2, eventName, data => {
          expect(data.channelId).equals(channel.id);
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
        const { workspace } = await workspaceService.createWorkspace(admin, 'testWorkspace');
        // authenticate user
        const adminSocket = io(server.info.uri);
        const successAuth = awaitSocketForEvent(true, adminSocket, eventNames.socket.authSuccess);
        adminSocket.emit(eventNames.client.auth, {
          token: tokens.accessToken,
          transaction: uuid4(),
          workspaceId: workspace.id
        });
        await successAuth;
        // create workspace
        const notifyAboutJoinedUser = awaitSocketForEvent(true, adminSocket, eventNames.socket.userJoined, data => {
          expect(data.user.id).equals(user.id);
        });
        // join user by invite (without await because
        // we are awaiting the event
        await workspaceService.addUserToWorkspace(workspace.id, user.id);
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
        const { workspace: w2 } = await workspaceService.createWorkspace(notMember, 'test2');
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
        adminSocket.emit(eventNames.client.auth, {
          token: adminTokens.accessToken,
          transaction: uuid4(),
          workspaceId: workspace.id
        });
        memberSocket.emit(eventNames.client.auth, {
          token: memberTokens.accessToken, 
          transaction: uuid4(),
          workspaceId: workspace.id
        });
        notMemberSocket.emit(eventNames.client.auth, { 
          token: notMemberTokens.accessToken, 
          transaction: uuid4(),
          workspaceId: w2.id
        });
        await Promise.all([awaitAdminAuth, awaitMemberAuth, awaitNotMemberAuth]);
        
        /**
         * Сейчас админ с помощью API запроса присоединится к каналу
         * Ждём, что админ и мембер получат уведомления о присоединении
         * При этом не мембер не получит
         */
        eventName = eventNames.socket.userSelectedChannel;
        const awaitNotifyForAdmin = awaitSocketForEvent(true, adminSocket, eventName, data => {
          expect(data.channelId).equals(channel.id);
        });
        const awaitNotifyForMember = awaitSocketForEvent(true, memberSocket, eventName, data => {
          expect(data.channelId).equals(channel.id);
        });
        const notAwaitUserSelected = awaitSocketForEvent(false, notMemberSocket, eventName);
        await server.inject({
          method: 'POST',
          url: `/channels/${channel.id}/select?socketId=${adminSocket.id}`,
          ...helpers.withAuthorization(adminTokens),
          payload: helpers.defaultUserState()
        });
        await Promise.race([
          Promise.all([
            awaitNotifyForAdmin,
            awaitNotifyForMember
          ]),
          notAwaitUserSelected
        ]);
      });
      it('All members get media state of the user who just connected', async () => {
        const {
          userService,
          workspaceService
        } = server.services();
        const admin = await userService.signup({ email: 'admin@world.net' });
        const user1 = await userService.signup({ email: 'user@world.net' });
        const { workspace } = await workspaceService.createWorkspace(admin, 'test');
        await workspaceService.addUserToWorkspace(workspace.id, user1.id);
        const channel = await workspaceService.createChannel(workspace.id, admin.id, {
          isPrivate: false,
          name: 'testChannel'
        });
        const adminTokens = await userService.createTokens(admin);
        const user1Tokens = await userService.createTokens(user1);

        // authenticate 2 users
        const adminSocket = io(server.info.uri);
        const user1Socket = io(server.info.uri);
        let eventName = eventNames.socket.authSuccess;
        const adminAuth = awaitSocketForEvent(true, adminSocket, eventName, data => {
          expect(data).includes('userId');
        });
        const user1Auth = awaitSocketForEvent(true, user1Socket, eventName, data => {
          expect(data).includes('userId');
        });
        adminSocket.emit(eventNames.client.auth, { 
          token: adminTokens.accessToken, 
          transaction: uuid4(),
          workspaceId: workspace.id
        });
        user1Socket.emit(eventNames.client.auth, { 
          token: user1Tokens.accessToken, 
          transaction: uuid4(),
          workspaceId: workspace.id
        });
        await Promise.all([adminAuth, user1Auth]);

        /**
         * Админ коннектится к каналу
         * Пользователь должен получить mediaState админа
         */
        const adminMediaState = helpers.defaultUserState();
        adminMediaState.microphone = true;
        const user1Notified = awaitSocketForEvent(true, user1Socket, eventNames.socket.userSelectedChannel, data => {
          expect(data.userMediaState).exists();
          schemas.userMediaState.validate(data.userMediaState);
          expect(data.userMediaState).equals(adminMediaState);
        });
        const response = await server.inject({
          method: 'POST',
          url: `/channels/${channel.id}/select?socketId=${adminSocket.id}`,
          ...helpers.withAuthorization(adminTokens),
          payload: adminMediaState
        });
        expect(response.statusCode).equals(200);
        await user1Notified;
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
        const { workspace: w2 } = await workspaceService.createWorkspace(notMember, 'test2');
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
        adminSocket.emit(eventNames.client.auth, { 
          token: adminTokens.accessToken, 
          transaction: uuid4(),
          workspaceId: workspace.id
        });
        memberSocket.emit(eventNames.client.auth, { 
          token: memberTokens.accessToken, 
          transaction: uuid4(),
          workspaceId: workspace.id
        });
        notMemberSocket.emit(eventNames.client.auth, { 
          token: notMemberTokens.accessToken, 
          transaction: uuid4(),
          workspaceId: w2.id
        });
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
          method: 'POST',
          url: `/channels/${privateChannel.id}/select?socketId=${adminSocket.id}`,
          ...helpers.withAuthorization(adminTokens),
          payload: helpers.defaultUserState()
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
          method: 'POST',
          url: `/channels/${publicChannel.id}/select?socketId=${adminSocket.id}`,
          ...helpers.withAuthorization(adminTokens),
          payload: helpers.defaultUserState()
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
    describe('User has two connections, try to select several channels', () => {
      it('First socket gets an event about the second connection', async () => {
        const {
          userService,
          workspaceService
        } = server.services();
        const user = await userService.signup({ email: 'user@world.net' });
        const { workspace } = await workspaceService.createWorkspace(user, 'test');
        const firstChannel = await workspaceService.createChannel(workspace.id, user.id, {
          isPrivate: true,
          name: 'first'
        });
        const secondChannel = await workspaceService.createChannel(workspace.id, user.id, {
          isPrivate: false,
          name: 'second'
        });
        const userTokens = await userService.createTokens(user);

        // authenticate 2 socket connection for the single user
        const firstSocket = io(server.info.uri);
        const secondSocket = io(server.info.uri);
        let eventName = eventNames.socket.authSuccess;
        const firstAuth = awaitSocketForEvent(true, firstSocket, eventName, data => {
          expect(data).includes('userId');
        });
        const secondAuth = awaitSocketForEvent(true, secondSocket, eventName, data => {
          expect(data).includes('userId');
        });
        firstSocket.emit(eventNames.client.auth, {
          token: userTokens.accessToken,
          transaction: uuid4(),
          workspaceId: workspace.id
        });
        secondSocket.emit(eventNames.client.auth, {
          token: userTokens.accessToken, 
          transaction: uuid4(),
          workspaceId: workspace.id
        });
        await Promise.all([firstAuth, secondAuth]);

        // select first channel
        const response1 = await server.inject({
          method: 'POST',
          url: `/channels/${firstChannel.id}/select?socketId=${firstSocket.id}`,
          ...helpers.withAuthorization(userTokens),
          payload: helpers.defaultUserState()
        });
        expect(response1.statusCode).equals(200);

        // the first socket gets event about the second connection
        const waitEvent = awaitSocketForEvent(true, firstSocket, eventNames.socket.changedDevice);
        const response2 = await server.inject({
          method: 'POST',
          url: `/channels/${secondChannel.id}/select?socketId=${secondSocket.id}`,
          ...helpers.withAuthorization(userTokens),
          payload: helpers.defaultUserState()
        });
        expect(response2.statusCode).equals(200);
        await waitEvent;
      });
    });
    describe('User has two connections, try to select the same channel with two connections', () => {
      it('First socket gets an event about the second connection', async () => {
        const {
          userService,
          workspaceService
        } = server.services();
        const user = await userService.signup({ email: 'user@world.net' });
        const { workspace } = await workspaceService.createWorkspace(user, 'test');
        const singleChannel = await workspaceService.createChannel(workspace.id, user.id, {
          isPrivate: true,
          name: 'first'
        });
        const userTokens = await userService.createTokens(user);

        // authenticate 2 socket connection for the single user
        const firstSocket = io(server.info.uri);
        const secondSocket = io(server.info.uri);
        let eventName = eventNames.socket.authSuccess;
        const firstAuth = awaitSocketForEvent(true, firstSocket, eventName, data => {
          expect(data).includes('userId');
        });
        const secondAuth = awaitSocketForEvent(true, secondSocket, eventName, data => {
          expect(data).includes('userId');
        });
        firstSocket.emit(eventNames.client.auth, { 
          token: userTokens.accessToken, 
          transaction: uuid4(),
          workspaceId: workspace.id
        });
        secondSocket.emit(eventNames.client.auth, { 
          token: userTokens.accessToken, 
          transaction: uuid4(),
          workspaceId: workspace.id
        });
        await Promise.all([firstAuth, secondAuth]);

        // select first channel
        const response1 = await server.inject({
          method: 'POST',
          url: `/channels/${singleChannel.id}/select?socketId=${firstSocket.id}`,
          ...helpers.withAuthorization(userTokens),
          payload: helpers.defaultUserState()
        });
        expect(response1.statusCode).equals(200);

        // the first socket gets event about the second connection
        const waitEvent = awaitSocketForEvent(true, firstSocket, eventNames.socket.changedDevice);
        const response2 = await server.inject({
          method: 'POST',
          url: `/channels/${singleChannel.id}/select?socketId=${secondSocket.id}`,
          ...helpers.withAuthorization(userTokens),
          payload: helpers.defaultUserState()
        });
        expect(response2.statusCode).equals(200);
        await waitEvent;
      });
    });
  });

  describe('Testing update user media state', () => {
    describe('User select a channel, update media state', () => {
      it('all member gets new media state of that user', async () => {
        const {
          userService,
          workspaceService,
        } = server.services();
        const user1 = await userService.signup({ email: 'user1@world.net' });
        const user2 = await userService.signup({ email: 'user2@world.net' });
        const user3 = await userService.signup({ email: 'user3@world.net' });
        const { workspace } = await workspaceService.createWorkspace(user1, 'test');
        await workspaceService.addUserToWorkspace(workspace.id, user2.id);
        await workspaceService.addUserToWorkspace(workspace.id, user3.id);
        const channel = await workspaceService.createChannel(workspace.id, user1.id, {
          isPrivate: true,
          name: 'first'
        });
        await workspaceService.addMembersToChannel(channel.id, workspace.id, [user2.id]);
        const user1Tokens = await userService.createTokens(user1);
        const user2Tokens = await userService.createTokens(user2);
        const user3Tokens = await userService.createTokens(user3);

        // authenticate all users
        const socket1 = io(server.info.uri);
        const socket2 = io(server.info.uri);
        const socket3 = io(server.info.uri);

        let eventName = eventNames.socket.authSuccess;
        const auth1 = awaitSocketForEvent(true, socket1, eventName, data => {
          expect(data).includes('userId');
        });
        const auth2 = awaitSocketForEvent(true, socket2, eventName, data => {
          expect(data).includes('userId');
        });
        const auth3 = awaitSocketForEvent(true, socket3, eventName, data => {
          expect(data).includes('userId');
        });
        socket1.emit(eventNames.client.auth, { 
          token: user1Tokens.accessToken, 
          transaction: uuid4(),
          workspaceId: workspace.id
        });
        socket2.emit(eventNames.client.auth, { 
          token: user2Tokens.accessToken, 
          transaction: uuid4(),
          workspaceId: workspace.id
        });
        socket3.emit(eventNames.client.auth, { 
          token: user3Tokens.accessToken, 
          transaction: uuid4(),
          workspaceId: workspace.id
        });
        await Promise.all([auth1, auth2, auth3]);

        // user1 selects channel
        const response1 = await server.inject({
          method: 'POST',
          url: `/channels/${channel.id}/select?socketId=${socket1.id}`,
          ...helpers.withAuthorization(user1Tokens),
          payload: helpers.defaultUserState()
        });
        expect(response1.statusCode).equals(200);

        // user2 gets an event about changed media state
        // but user3 doesnt get that event (because he is not member of the channel)
        eventName = eventNames.socket.mediaStateUpdated;
        const newMediaState = helpers.defaultUserState();
        newMediaState.microphone = true;
        const user2Event = awaitSocketForEvent(true, socket2, eventName, data => {
          expect(data.userId).equals(user1.id);
          expect(data.userMediaState).equals(newMediaState);
          expect(data.channelId).equals(channel.id);
        });
        const user3NotEvent = awaitSocketForEvent(false, socket3, eventName);
        // user1 updates media state
        const response2 = await server.inject({
          method: 'POST',
          url: `/user/media-state?socketId=${socket1.id}`,
          ...helpers.withAuthorization(user1Tokens),
          payload: newMediaState
        });
        expect(response2.statusCode).equals(200);
        await Promise.race([
          user2Event,
          user3NotEvent
        ]);
      });
    });
  });

  describe('Testing notification about user leaved workspace', () => {
    describe('User leaves the workspace', () => {
      it('all workspace members should be notified about it', async () => {
        const {
          userService,
          workspaceService,
        } = server.services();
        const user1 = await userService.signup({ email: 'user1@world.net' });
        const user2 = await userService.signup({ email: 'user2@world.net' });
        const user3 = await userService.signup({ email: 'user3@world.net' });

        const { workspace } = await workspaceService.createWorkspace(user1, 'test');
        const { workspace: w2 } = await workspaceService.createWorkspace(user3, 'test2');
        await workspaceService.addUserToWorkspace(workspace.id, user2.id);
        const user1Tokens = await userService.createTokens(user1);
        const user2Tokens = await userService.createTokens(user2);
        const user3Tokens = await userService.createTokens(user3);

        // authenticate all users
        const socket1 = io(server.info.uri);
        const socket2 = io(server.info.uri);
        const socket3 = io(server.info.uri);

        let eventName = eventNames.socket.authSuccess;
        const auth1 = awaitSocketForEvent(true, socket1, eventName, data => {
          expect(data).includes('userId');
        });
        const auth2 = awaitSocketForEvent(true, socket2, eventName, data => {
          expect(data).includes('userId');
        });
        const auth3 = awaitSocketForEvent(true, socket3, eventName, data => {
          expect(data).includes('userId');
        });
        socket1.emit(eventNames.client.auth, { 
          token: user1Tokens.accessToken, 
          transaction: uuid4(),
          workspaceId: workspace.id
        });
        socket2.emit(eventNames.client.auth, { 
          token: user2Tokens.accessToken, 
          transaction: uuid4(),
          workspaceId: workspace.id
        });
        socket3.emit(eventNames.client.auth, { 
          token: user3Tokens.accessToken, 
          transaction: uuid4(),
          workspaceId: w2.id
        });
        await Promise.all([auth1, auth2, auth3]);

        // user2 leaves the workspace
        const response = await server.inject({
          method: 'POST',
          url: `/workspaces/${workspace.id}/leave`,
          ...helpers.withAuthorization(user2Tokens)
        });
        expect(response.statusCode).equals(200);

        // user1 should be notified, user3 shouldnt be
        eventName = eventNames.socket.userLeavedWorkspace;
        const user1Notified = awaitSocketForEvent(true, socket1, eventName, data => {
          expect(data.userId).equals(user2.id);
        });
        const user3NotNotified = awaitSocketForEvent(false, socket3, eventName);
        await Promise.race([user1Notified, user3NotNotified]);
      });
    });
  });

  describe('Testing update user profile', () => {
    describe('User updates his own profile', () => {
      it('Users from all workspaces should be notified', async () => {
        const {
          userService,
          workspaceService
        } = server.services();
        const user1 = await userService.signup({ email: 'adm@adm.ru', name: 'n1' });
        const user2 = await userService.signup({ email: 'adm2@adm.ru', name: 'n2' });
        const user3 = await userService.signup({ email: 'adm3@adm.ru', name: 'n3' });
        const { workspace: w1 } = await workspaceService.createWorkspace(user1, 'workspace1');
        const { workspace: w2 } = await workspaceService.createWorkspace(user2, 'workspace2');
        await workspaceService.addUserToWorkspace(w1.id, user3.id);
        await workspaceService.addUserToWorkspace(w2.id, user3.id);
        
        // authenticate user1 and user2 to sockets
        const tokens1 = await userService.createTokens(user1);
        const tokens2 = await userService.createTokens(user2);
        const socket1 = io(server.info.uri);
        const socket2 = io(server.info.uri);
        let evtName = eventNames.socket.authSuccess;
        const awaitForAuth1 = awaitSocketForEvent(true, socket1, evtName);
        const awaitForAuth2 = awaitSocketForEvent(true, socket2, evtName);
        socket1.emit(eventNames.client.auth, { 
          token: tokens1.accessToken,
          workspaceId: w1.id
        });
        socket2.emit(eventNames.client.auth, { 
          token: tokens2.accessToken,
          workspaceId: w2.id 
        });
        await Promise.all([awaitForAuth1, awaitForAuth2]);

        // await for user update profile event
        let newName = 'newName';
        evtName = eventNames.socket.userUpdated;
        const checkDataFunc = data => {
          expect(data.user.name).equals(newName);
          expect(data.user.id).equals(user3.id);
        };
        const awaitForNotify1 = awaitSocketForEvent(true, socket1, evtName, checkDataFunc);
        const awaitForNotify2 = awaitSocketForEvent(true, socket2, evtName, checkDataFunc);
        const tokens3 = await userService.createTokens(user3);
        const response = await server.inject({
          method: 'POST',
          url: '/profile',
          ...helpers.withAuthorization(tokens3),
          payload: { name: newName }
        });
        expect(response.statusCode).equals(200);
        await Promise.all([awaitForNotify1, awaitForNotify2]);
      });
    });
  });

  describe('Testing delete channel', () => {
    describe('Channel is deleted', () => {
      it('All users of that channel should be notified', async () => {
        const {
          userService,
          workspaceService
        } = server.services();
        const user1 = await userService.signup({ email: 'adm@adm.ru', name: 'n1' });
        const user2 = await userService.signup({ email: 'adm2@adm.ru', name: 'n2' });
        const { workspace: w1 } = await workspaceService.createWorkspace(user1, 'workspace1');
        await workspaceService.addUserToWorkspace(w1.id, user2.id);
        const channel = await workspaceService.createChannel(w1.id, user1.id, {
          name: 'test',
          isPrivate: false
        });
        
        // authenticate user1 and user2 to sockets
        const tokens1 = await userService.createTokens(user1);
        const tokens2 = await userService.createTokens(user2);
        const socket1 = io(server.info.uri);
        const socket2 = io(server.info.uri);
        let evtName = eventNames.socket.authSuccess;
        const awaitForAuth1 = awaitSocketForEvent(true, socket1, evtName);
        const awaitForAuth2 = awaitSocketForEvent(true, socket2, evtName);
        socket1.emit(eventNames.client.auth, { 
          token: tokens1.accessToken,
          workspaceId: w1.id
        });
        socket2.emit(eventNames.client.auth, { 
          token: tokens2.accessToken,
          workspaceId: w1.id 
        });
        await Promise.all([awaitForAuth1, awaitForAuth2]);

        // delete channel, wait for event
        evtName = eventNames.socket.channelDeleted;
        const checkData = data => expect(data.channelId).equals(channel.id);
        const deleteChannelEvent1 = awaitSocketForEvent(true, socket1, evtName, checkData);
        const deleteChannelEvent2 = awaitSocketForEvent(true, socket2, evtName, checkData);
        await workspaceService.deleteChannel(channel.id);
        await Promise.all([deleteChannelEvent1, deleteChannelEvent2]);
      });
    });
  });

  describe('Testing updating online statuses', () => {
    it('testing different scenarious', async () => {
      const {
        userService,
        workspaceService
      } = server.services();
      const user1 = await userService.signup({ email: 'user1@email.email', name: 'user1' });
      const user2 = await userService.signup({ email: 'user2@email.email', name: 'user2' });
      const user3 = await userService.signup({ email: 'user3@email.email', name: 'user3' });

      const { workspace } = await workspaceService.createWorkspace(user1, 'name');
      await workspaceService.addUserToWorkspace(workspace.id, user2.id);
      await workspaceService.addUserToWorkspace(workspace.id, user3.id);

      // create tokens for all users
      const tokens1 = await userService.createTokens(user1);
      const tokens2 = await userService.createTokens(user2);
      const tokens3 = await userService.createTokens(user3);

      // connect 2 users
      const socket2 = io(server.info.uri);
      const socket3 = io(server.info.uri);
      let evtName = eventNames.socket.authSuccess;
      const awaitForAuth2 = awaitSocketForEvent(true, socket2, evtName);
      const awaitForAuth3 = awaitSocketForEvent(true, socket3, evtName);
      socket2.emit(eventNames.client.auth, { 
        token: tokens2.accessToken,
        workspaceId: workspace.id
      });
      socket3.emit(eventNames.client.auth, { 
        token: tokens3.accessToken,
        workspaceId: workspace.id 
      });
      await Promise.all([awaitForAuth2, awaitForAuth3]);

      // user 1 requests full state of workspace
      const response = await server.inject({
        method: 'GET',
        url: `/workspaces/${workspace.id}`,
        ...helpers.withAuthorization(tokens1)
      });
      expect(response.statusCode).equals(200);
      const payload = JSON.parse(response.payload);
      expect(payload.users.length).equals(3);
      // check that user2 and user3 is online
      expect(payload.users.find(u => u.id === user2.id).onlineStatus).equals('online');
      expect(payload.users.find(u => u.id === user3.id).onlineStatus).equals('online');
      // check that user1 is offline
      expect(payload.users.find(u => u.id === user1.id).onlineStatus).equals('offline');

      // disconnect user3
      socket3.disconnect();
      // wait some time
      await new Promise(resolve => setTimeout(resolve, 10));
      const response2 = await server.inject({
        method: 'GET',
        url: `/workspaces/${workspace.id}`,
        ...helpers.withAuthorization(tokens1)
      });
      expect(response.statusCode).equals(200);
      const payload2 = JSON.parse(response2.payload);
      expect(payload2.users.find(u => u.id === user3.id).onlineStatus).equals('offline');

      // connect user1 with status 'idle'
      // socket2 await about new online status
      evtName = eventNames.socket.onlineStatusChanged;
      const waitForChangedOnlineStatus = awaitSocketForEvent(true, socket2, evtName, data => {
        expect(data.userId).equals(user1.id);
        expect(data.onlineStatus).equals('idle');
      });
      const socket1 = io(server.info.uri);
      evtName = eventNames.socket.authSuccess;
      const awaitForAuth1 = awaitSocketForEvent(true, socket1, evtName);
      socket1.emit(eventNames.client.auth, { 
        token: tokens1.accessToken,
        workspaceId: workspace.id,
        onlineStatus: 'idle'
      });
      await Promise.all([awaitForAuth1, waitForChangedOnlineStatus]);

      // user3 requests workspace full state
      const response3 = await server.inject({
        method: 'GET',
        url: `/workspaces/${workspace.id}`,
        ...helpers.withAuthorization(tokens3)
      });
      expect(response3.statusCode).equals(200);
      const payload3 = JSON.parse(response3.payload);
      expect(payload3.users.find(u => u.id === user1.id).onlineStatus).equals('idle');

      // ok, user1 change online-status to 'offline' by POST-request
      evtName = eventNames.socket.onlineStatusChanged;
      const waitOnlineStatusChangedBySocket2 = awaitSocketForEvent(true, socket2, evtName, data => {
        expect(data.userId).equals(user1.id);
        expect(data.onlineStatus).equals('offline');
      });
      const response4 = await server.inject({
        method: 'POST',
        url: `/user/online-status?socketId=${socket1.id}`,
        ...helpers.withAuthorization(tokens1),
        payload: { onlineStatus: 'offline' }
      });
      expect(response4.statusCode).equals(200);
      await waitOnlineStatusChangedBySocket2;
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
