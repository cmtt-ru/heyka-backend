'use strict';

const Lab = require('@hapi/lab');
const { describe, it, before, beforeEach, after } = exports.lab = Lab.script();
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
    socketIO.attach(server.listener, {
      pingInterval: 50
    });
    server.start();
    socket = io(`${server.info.uri}`);
    await new Promise(resolve => {
      socket.on('connect', () => {
        resolve();
      });
    });
  });

  after(async () => {
    await server.redis.client.flushdb();
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
    Object.values(stubbedMethods).forEach(m => m.reset());

    process.env.DISCONNECT_TIMEOUT = '0';
  });

  describe('Testing socket authentication', () => {
    describe('With valid auth tokens', () => {
      it('server should emit "auth-success" event', async () => {
        const { userService, workspaceService } = server.services();
        // sign up user and create valid tokens
        const user = await userService.signup({ email: 'hello@world.net' });
        const tokens = await userService.createTokens(user);
        const { workspace } = await workspaceService.createWorkspace(user, 'name');
        const socket = io(`${server.info.uri}`);
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

        socket.disconnect();
      });
    });
    
    describe('With an expired auth tokens', () => {
      it('should return two "error" events', async () => {
        const { userService, workspaceService } = server.services();
        const user = await userService.signup({ email: 'hello@world.net' });
        const tokens = await userService.createTokens(user, -2019, -2019);
        const { workspace } = await workspaceService.createWorkspace(user, 'name');
        const socket = io(`${server.info.uri}`);
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

        socket.disconnect();
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
        const socket = io(`${server.info.uri}`);
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

        socket.disconnect();
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


        socket1.disconnect();
        socket2.disconnect();
        socket3.disconnect();
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

        adminSocket.disconnect();
      });
      it('"workspace-added" event should be fired for added user', async () => {
        const {
          userService,
          workspaceService
        } = server.services();
        // sign up users and create valid tokens
        const admin = await userService.signup({ email: 'admin@world.net' });
        const user = await userService.signup({ email: 'user@world.net' });
        const tokens = await userService.createTokens(user);
        const { workspace } = await workspaceService.createWorkspace(admin, 'testWorkspace');
        const { workspace: workspace2 } = await workspaceService.createWorkspace(user, 'testWorkspace2');
        // authenticate user
        const userSocket = io(server.info.uri);
        const successAuth = awaitSocketForEvent(true, userSocket, eventNames.socket.authSuccess);
        userSocket.emit(eventNames.client.auth, {
          token: tokens.accessToken,
          transaction: uuid4(),
          workspaceId: workspace2.id
        });
        await successAuth;
        // create workspace
        const eventName = eventNames.socket.workspaceAdded;
        const notifyAboutWorkspaceAdded = awaitSocketForEvent(true, userSocket, eventName, data => {
          expect(data.workspace.id).equals(workspace.id);
          expect(data.workspace.userRelation.role).equals('admin');
        });
        // join user by invite (without await because
        // we are awaiting the event
        await workspaceService.addUserToWorkspace(workspace.id, user.id, 'admin');
        await notifyAboutWorkspaceAdded;

        userSocket.disconnect();
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

        adminSocket.disconnect();
        memberSocket.disconnect();
        notMemberSocket.disconnect();
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

        adminSocket.disconnect();
        user1Socket.disconnect();
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

        adminSocket.disconnect();
        memberSocket.disconnect();
        notMemberSocket.disconnect();
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

        firstSocket.disconnect();
        secondSocket.disconnect();
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

        firstSocket.disconnect();
        secondSocket.disconnect();
      });
    });
    describe('User select channel and then dicsonnect socket', () => {
      it('All workspace memebers should be notified about user disconnect channel', async () => {
        const {
          userService,
          workspaceService
        } = server.services();
        const user1 = await userService.signup({ email: 'admin@world.net' });
        const user2 = await userService.signup({ email: 'user@world.net' });
        const { workspace } = await workspaceService.createWorkspace(user1, 'test');
        await workspaceService.addUserToWorkspace(workspace.id, user2.id);
        const channel = await workspaceService.createChannel(workspace.id, user1.id, {
          isPrivate: false,
          name: 'testChannel'
        });
        const tokens1 = await userService.createTokens(user1);
        const tokens2 = await userService.createTokens(user2);

        // authenticate 2 users
        const socket1 = io(server.info.uri);
        const socket2 = io(server.info.uri);
        let eventName = eventNames.socket.authSuccess;
        const awaitSocket1Auth = awaitSocketForEvent(true, socket1, eventName, data => {
          expect(data).includes('userId');
        });
        const awaitSocket2Auth = awaitSocketForEvent(true, socket2, eventName, data => {
          expect(data).includes('userId');
        });
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
        await Promise.all([awaitSocket1Auth, awaitSocket2Auth]);
        
        /**
         * Пользователь 1 подключается к каналу, второй юзер узнает об этом
         */
        eventName = eventNames.socket.userSelectedChannel;
        const socket2NotifiedAboutSelect = awaitSocketForEvent(true, socket2, eventName, data => {
          expect(data.channelId).equals(channel.id);
          expect(data.userId).equals(user1.id);
        });
        await server.inject({
          method: 'POST',
          url: `/channels/${channel.id}/select?socketId=${socket1.id}`,
          ...helpers.withAuthorization(tokens1),
          payload: helpers.defaultUserState()
        });
        await socket2NotifiedAboutSelect;

        /**
         * Пользователь 1 дисконнектится сокетом, юзер 2 узнает об этом
         */
        eventName = eventNames.socket.userUnselectedChannel;
        const socket2NotifiedAboutUnselect = awaitSocketForEvent(true, socket2, eventName, data => {
          expect(data.channelId).equals(channel.id);
          expect(data.userId).equals(user1.id);
        });
        socket1.disconnect();
        await socket2NotifiedAboutUnselect;

        socket1.disconnect();
        socket2.disconnect();
      });
    });
    describe('User connected from two sockets, one of sockets if disconnected', ( )=> {
      it('User shouldnt be unselected from channel if not main socket is disconnected', async () => {
        const {
          userService,
          workspaceService
        } = server.services();
        const user1 = await userService.signup({ email: 'admin@world.net' });
        const user2 = await userService.signup({ email: 'user@world.net' });
        const { workspace } = await workspaceService.createWorkspace(user1, 'test');
        await workspaceService.addUserToWorkspace(workspace.id, user2.id);
        const channel = await workspaceService.createChannel(workspace.id, user1.id, {
          isPrivate: false,
          name: 'testChannel'
        });
        const tokens1 = await userService.createTokens(user1);
        const tokens2 = await userService.createTokens(user2);

        // authenticate 3 users
        const socket1 = io(server.info.uri);
        const socket1a = io(server.info.uri);
        const socket2 = io(server.info.uri);
        let eventName = eventNames.socket.authSuccess;
        const awaitSocket1Auth = awaitSocketForEvent(true, socket1, eventName, data => {
          expect(data).includes('userId');
        });
        const awaitSocket1aAuth = awaitSocketForEvent(true, socket1a, eventName, data => {
          expect(data).includes('userId');
        });
        const awaitSocket2Auth = awaitSocketForEvent(true, socket2, eventName, data => {
          expect(data).includes('userId');
        });
        socket1.emit(eventNames.client.auth, {
          token: tokens1.accessToken,
          transaction: uuid4(),
          workspaceId: workspace.id
        });
        socket1a.emit(eventNames.client.auth, {
          token: tokens1.accessToken,
          transaction: uuid4(),
          workspaceId: workspace.id
        });
        socket2.emit(eventNames.client.auth, {
          token: tokens2.accessToken, 
          transaction: uuid4(),
          workspaceId: workspace.id
        });
        await Promise.all([awaitSocket1Auth, awaitSocket1aAuth, awaitSocket2Auth]);
        
        /**
         * Пользователь 1 подключается к каналу, второй юзер узнает об этом
         */
        eventName = eventNames.socket.userSelectedChannel;
        const socket2NotifiedAboutSelect = awaitSocketForEvent(true, socket2, eventName, data => {
          expect(data.channelId).equals(channel.id);
          expect(data.userId).equals(user1.id);
        });
        await server.inject({
          method: 'POST',
          url: `/channels/${channel.id}/select?socketId=${socket1.id}`,
          ...helpers.withAuthorization(tokens1),
          payload: helpers.defaultUserState()
        });
        await socket2NotifiedAboutSelect;

        /**
         * Пользователь 1 дисконнектится НЕ главным сокетом, юзера не должно отдисконнектить
         */
        eventName = eventNames.socket.userUnselectedChannel;
        const socket2NotNotifiedAboutUnselect = awaitSocketForEvent(false, socket2, eventName);
        socket1a.disconnect();
        await Promise.race([
          new Promise(resolve => setTimeout(resolve, 100)),
          socket2NotNotifiedAboutUnselect
        ]);

        /**
         * Пользователь 1 дисконнектится ГЛАВНЫМ сокетом, юзер должен отдисконнектиться
         */
        eventName = eventNames.socket.userUnselectedChannel;
        const socket2NotifiedAboutUnselect = awaitSocketForEvent(true, socket2, eventName, data => {
          expect(data.userId).equals(user1.id);
        });
        socket1.disconnect();
        await socket2NotifiedAboutUnselect;

        socket1.disconnect();
        socket1a.disconnect();
        socket2.disconnect();
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

        socket1.disconnect();
        socket2.disconnect();
        socket3.disconnect();
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

        socket1.disconnect();
        socket2.disconnect();
        socket3.disconnect();
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

        socket1.disconnect();
        socket2.disconnect();
      });
    });
    describe('User update his own app-settings', () => {
      it('User should be notified about his own update with type of updation', async () => {
        const {
          userService,
          workspaceService
        } = server.services();
        const user = await userService.signup({ name: 'user' });
        const { workspace: w } = await workspaceService.createWorkspace(user, 'workspace');
        
        // authenticate user1 and user2 to sockets
        const tokens = await userService.createTokens(user);
        const socket1 = io(server.info.uri);
        const socket2 = io(server.info.uri);
        let evtName = eventNames.socket.authSuccess;
        const awaitForAuth1 = awaitSocketForEvent(true, socket1, evtName);
        const awaitForAuth2 = awaitSocketForEvent(true, socket2, evtName);
        socket1.emit(eventNames.client.auth, { 
          token: tokens.accessToken,
          workspaceId: w.id
        });
        socket2.emit(eventNames.client.auth, { 
          token: tokens.accessToken,
          workspaceId: w.id 
        });
        await Promise.all([awaitForAuth1, awaitForAuth2]);

        // await for user update profile event
        const newAppSettings = { theme: 'dark' };
        evtName = eventNames.socket.meUpdated;
        const checkDataFunc = data => {
          expect(data.user.appSettings).equals(newAppSettings);
          expect(data.whatWasUpdated).equals('app-settings');
        };
        const awaitForNotify1 = awaitSocketForEvent(true, socket1, evtName, checkDataFunc);
        const awaitForNotify2 = awaitSocketForEvent(true, socket2, evtName, checkDataFunc);
        const response = await server.inject({
          method: 'POST',
          url: '/me/app-settings',
          ...helpers.withAuthorization(tokens),
          payload: newAppSettings
        });
        expect(response.statusCode).equals(200);
        await Promise.all([awaitForNotify1, awaitForNotify2]);

        socket1.disconnect();
        socket2.disconnect();
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

        socket1.disconnect();
        socket2.disconnect();
      });
    });
  });

  describe('Testing update channel', () => {
    describe('Channel is updated', () => {
      it('All users of that channel should be notified', async () => {
        const {
          userService,
          workspaceService,
          channelService,
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

        // update channel, wait for event
        const updateData = {
          name: 'new-name',
          description: 'new-description',
        };
        
        evtName = eventNames.socket.channelUpdated;
        const checkData = data => {
          expect(data.channel.name).equals(updateData.name);
          expect(data.channel.description).equals(updateData.description);
        };
        const updateChannelEvent1 = awaitSocketForEvent(true, socket1, evtName, checkData);
        const updateChannelEvent2 = awaitSocketForEvent(true, socket2, evtName, checkData);

        await channelService.updateChannelInfo(channel.id, updateData);

        await Promise.all([updateChannelEvent1, updateChannelEvent2]);

        socket1.disconnect();
        socket2.disconnect();
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

      socket1.disconnect();
      socket2.disconnect();
      socket3.disconnect();
    });
    it('first user joined workspace, second should be notified', async () => {
      const {
        userService,
        workspaceService
      } = server.services();
      const user1 = await userService.signup({ email: 'user1@email.email', name: 'user1' });
      const user2 = await userService.signup({ email: 'user2@email.email', name: 'user2' });

      const { workspace } = await workspaceService.createWorkspace(user1, 'name');
      await workspaceService.addUserToWorkspace(workspace.id, user2.id);

      // create tokens for all users
      const tokens1 = await userService.createTokens(user1);
      const tokens2 = await userService.createTokens(user2);

      // connect first users
      const socket1 = io(server.info.uri);
      const awaitForAuth1 = awaitSocketForEvent(true, socket1, eventNames.socket.authSuccess);
      socket1.emit(eventNames.client.auth, { 
        token: tokens1.accessToken,
        workspaceId: workspace.id
      });
      await Promise.all([awaitForAuth1]);

      // prepare promise that wait event about second user connected
      const awaitSecondConnected = awaitSocketForEvent(true, socket1, eventNames.socket.onlineStatusChanged, data => {
        expect(data.userId).equals(user2.id);
      });

      // connect second user
      const socket2 = io(server.info.uri);
      const awaitForAuth2 = awaitSocketForEvent(true, socket2, eventNames.socket.authSuccess);
      socket2.emit(eventNames.client.auth, { 
        token: tokens2.accessToken,
        workspaceId: workspace.id
      });

      // Await second joined workspace and the first received message about second joined
      await Promise.all([awaitForAuth2, awaitSecondConnected]);

      socket1.disconnect();
      socket2.disconnect();
    });
    it('first user left workspace, second should be notified', async () => {
      const {
        userService,
        workspaceService
      } = server.services();
      const user1 = await userService.signup({ email: 'user1@email.email', name: 'user1' });
      const user2 = await userService.signup({ email: 'user2@email.email', name: 'user2' });

      const { workspace } = await workspaceService.createWorkspace(user1, 'name');
      await workspaceService.addUserToWorkspace(workspace.id, user2.id);

      // create tokens for all users
      const tokens1 = await userService.createTokens(user1);
      const tokens2 = await userService.createTokens(user2);

      // connect first users
      const socket1 = io(server.info.uri);
      const awaitForAuth1 = awaitSocketForEvent(true, socket1, eventNames.socket.authSuccess);
      socket1.emit(eventNames.client.auth, { 
        token: tokens1.accessToken,
        workspaceId: workspace.id
      });
      // connect second user
      const socket2 = io(server.info.uri);
      const awaitForAuth2 = awaitSocketForEvent(true, socket2, eventNames.socket.authSuccess);
      socket2.emit(eventNames.client.auth, { 
        token: tokens2.accessToken,
        workspaceId: workspace.id
      });
      // wait the both are connected
      await Promise.all([awaitForAuth1, awaitForAuth2]);

      // prepare promise that wait event about second user is disconnected
      const awaitSecondConnected = awaitSocketForEvent(true, socket1, eventNames.socket.onlineStatusChanged, data => {
        expect(data.userId).equals(user2.id);
        expect(data.onlineStatus).equals('offline');
      });

      // disconnect second user
      socket2.disconnect();

      // wait for event
      await awaitSecondConnected;

      socket1.disconnect();
    });
    it('first user joined different workspace, second user should be notified in first wrksps', async () => {
      const {
        userService,
        workspaceService
      } = server.services();
      const user1 = await userService.signup({ email: 'user1@email.email', name: 'user1' });
      const user2 = await userService.signup({ email: 'user2@email.email', name: 'user2' });

      const { workspace } = await workspaceService.createWorkspace(user1, 'name');
      const { workspace: w2 } = await workspaceService.createWorkspace(user1, 'name2');
      await workspaceService.addUserToWorkspace(workspace.id, user2.id);

      // create tokens for all users
      const tokens1 = await userService.createTokens(user1);
      const tokens2 = await userService.createTokens(user2);

      // connect second user
      const socket2 = io(server.info.uri);
      const awaitForAuth2 = awaitSocketForEvent(true, socket2, eventNames.socket.authSuccess);
      socket2.emit(eventNames.client.auth, { 
        token: tokens2.accessToken,
        workspaceId: workspace.id
      });
      await Promise.all([awaitForAuth2]);

      // prepare promise that wait event about second user connected
      const awaitFirstConnected = awaitSocketForEvent(true, socket2, eventNames.socket.onlineStatusChanged, data => {
        expect(data.userId).equals(user1.id);
      });

      // connect second user
      const socket1 = io(server.info.uri);
      const awaitForAuth1 = awaitSocketForEvent(true, socket1, eventNames.socket.authSuccess);
      socket1.emit(eventNames.client.auth, { 
        token: tokens1.accessToken,
        workspaceId: w2.id
      });

      // Await second joined workspace and the first received message about second joined
      await Promise.all([awaitForAuth1, awaitFirstConnected]);

      socket1.disconnect();
      socket2.disconnect();
    });
  });

  describe('Testing online statuses in different workspaces', () => {
    it('User1 and User2 in different workspaces, check that online status is shared', async () => {
      const {
        userService,
        workspaceService
      } = server.services();
      const user1 = await userService.signup({ email: 'user1@email.email', name: 'user1' });
      const user2 = await userService.signup({ email: 'user2@email.email', name: 'user2' });
  
      const { workspace: w1 } = await workspaceService.createWorkspace(user1, 'name');
      const { workspace: w2 } = await workspaceService.createWorkspace(user1, 'name');
      await workspaceService.addUserToWorkspace(w1.id, user2.id);
      await workspaceService.addUserToWorkspace(w2.id, user2.id);
  
      // create tokens for all users
      const tokens1 = await userService.createTokens(user1);
      const tokens2 = await userService.createTokens(user2);
  
      // connect 2 users
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
  
      // user 1 requests full state of workspace
      const response = await server.inject({
        method: 'GET',
        url: `/workspaces/${w1.id}`,
        ...helpers.withAuthorization(tokens1)
      });
      expect(response.statusCode).equals(200);
      // check that user2 and user1 is online
      expect(response.result.users.find(u => u.id === user1.id).onlineStatus).equals('online');
      expect(response.result.users.find(u => u.id === user2.id).onlineStatus).equals('online');

      // wait event about user disconnected
      evtName = eventNames.socket.onlineStatusChanged;
      const waitForUser2GoesOffline = awaitSocketForEvent(true, socket1, evtName, data => {
        expect(data.userId).equals(user2.id);
        expect(data.onlineStatus).equals('offline');
      });
  
      // disconnect user2
      socket2.disconnect();

      await waitForUser2GoesOffline;
  
      socket1.disconnect();
      socket2.disconnect();
    });
    it('Connect to different workspaces by single user with several devices', async () => {
      const {
        userService,
        workspaceService
      } = server.services();
      const user1 = await userService.signup({ email: 'user1@email.email', name: 'user1' });
  
      const { workspace: w1 } = await workspaceService.createWorkspace(user1, 'name');
      const { workspace: w2 } = await workspaceService.createWorkspace(user1, 'name');
  
      // create tokens for all users
      const tokens1 = await userService.createTokens(user1);
  
      // connect 2 users
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
        token: tokens1.accessToken,
        workspaceId: w2.id 
      });
      await Promise.all([awaitForAuth1, awaitForAuth2]);

      // go sleep by first device
      const response = await server.inject({
        method: 'POST',
        url: `/user/online-status?socketId=${socket1.id}`,
        payload: {
          onlineStatus: 'idle',
          cause: 'sleep',
        },
        ...helpers.withAuthorization(tokens1)
      });
      expect(response.statusCode).equals(200);
  
      // user 1 requests full state of workspace. Online status should be online
      const response2 = await server.inject({
        method: 'GET',
        url: `/workspaces/${w1.id}`,
        ...helpers.withAuthorization(tokens1)
      });
      expect(response2.statusCode).equals(200);
      // check that user 1 is online
      expect(response2.result.users.find(u => u.id === user1.id).onlineStatus).equals('online');

      // change online status to idle by second device
      const response3 = await server.inject({
        method: 'POST',
        url: `/user/online-status?socketId=${socket2.id}`,
        payload: {
          onlineStatus: 'idle',
        },
        ...helpers.withAuthorization(tokens1)
      });
      expect(response3.statusCode).equals(200);

      // check that user has "idle"
      const response4 = await server.inject({
        method: 'GET',
        url: `/workspaces/${w1.id}`,
        ...helpers.withAuthorization(tokens1)
      });
      expect(response4.statusCode).equals(200);
      // check that user 1 is online
      expect(response4.result.users.find(u => u.id === user1.id).onlineStatus).equals('idle');

      // awake by first device
      const response5 = await server.inject({
        method: 'POST',
        url: `/user/online-status?socketId=${socket1.id}`,
        payload: {
          onlineStatus: 'online',
          cause: 'sleep',
        },
        ...helpers.withAuthorization(tokens1)
      });
      expect(response5.statusCode).equals(200);

      // check that user has "idle"
      const response6 = await server.inject({
        method: 'GET',
        url: `/workspaces/${w1.id}`,
        ...helpers.withAuthorization(tokens1)
      });
      expect(response6.statusCode).equals(200);
      // check that user 1 is online
      expect(response6.result.users.find(u => u.id === user1.id).onlineStatus).equals('idle');
  
      socket1.disconnect();
      socket2.disconnect();
    });
  });

  describe('Testing that connection is kept alive automatically', () => {
    it('connect to the workspace, check connections after a while it should be online', async () => {
      const {
        userService,
        workspaceService
      } = server.services();
        // set process.env.ONLINE_STATUS_LIFESPAN for testing
      process.env.ONLINE_STATUS_LIFESPAN = 60; // 60 ms
  
      const user = await userService.signup({ email: 'user1@email.email', name: 'user1' });
      const { workspace } = await workspaceService.createWorkspace(user, 'name');
      // create token
      const tokens = await userService.createTokens(user);
      // connect user
      const socket = io(server.info.uri);
      let evtName = eventNames.socket.authSuccess;
      const awaitForAuth = awaitSocketForEvent(true, socket, evtName);
      socket.emit(eventNames.client.auth, { 
        token: tokens.accessToken,
        workspaceId: workspace.id
      });
      await awaitForAuth;
      await helpers.skipSomeTime(75);
  
      // user 1 requests full state of workspace
      const response = await server.inject({
        method: 'GET',
        url: `/workspaces/${workspace.id}`,
        ...helpers.withAuthorization(tokens)
      });
      expect(response.statusCode).equals(200);
      const payload = JSON.parse(response.payload);
  
      expect(payload.users.filter(u => u.onlineStatus === 'online').length).equals(1);
      await helpers.skipSomeTime(75);
  
      const response2 = await server.inject({
        method: 'GET',
        url: `/workspaces/${workspace.id}`,
        ...helpers.withAuthorization(tokens)
      });
      expect(response2.statusCode).equals(200);
      const payload2 = JSON.parse(response.payload);
  
      expect(payload2.users.filter(u => u.onlineStatus === 'online').length).equals(1);
  
      // delete process.env.ONLINE_STATUS_LIFESPAN
      delete process.env.ONLINE_STATUS_LIFESPAN;
        
      socket.disconnect();
    });
  });

  describe('Testing messages', () => {
    describe('Try to send message to user that is not connected', () => {
      it('should return 400 User is not connected', async () => {
        const {
          userService,
          workspaceService,
          workspaceDatabaseService: wdb,
        } = server.services();
        const user1 = await userService.signup({ email: 'user1@email.email', name: 'user1' });
        const user2 = await userService.signup({ email: 'user2@email.email', name: 'user2' });
  
        const { workspace } = await workspaceService.createWorkspace(user1, 'name');
        await workspaceService.addUserToWorkspace(workspace.id, user2.id);
  
        // create tokens for user
        const tokens1 = await userService.createTokens(user1);

        const chnls = await wdb.getWorkspaceChannels(workspace.id);
  
        // send message to second user
        const response = await server.inject({
          method: 'POST',
          url: `/send-invite`,
          ...helpers.withAuthorization(tokens1),
          payload: {
            userId: user2.id,
            isResponseNeeded: true,
            message: { data: 'somedata' },
            workspaceId: workspace.id,
            channelId: chnls[0].id
          }
        });
        expect(response.statusCode).equals(400);
        const payload = JSON.parse(response.payload);
        expect(payload.message).equals('User is not connected');
      });
    });
    describe('Try to send message to user that connected from different devices in different workspaces', () => {
      it('All user devices should get message', async () => {
        const {
          userService,
          workspaceService,
          workspaceDatabaseService: wdb,
        } = server.services();
        const user1 = await userService.signup({ email: 'user1@email.email', name: 'user1' });
        const user2 = await userService.signup({ email: 'user2@email.email', name: 'user2' });
  
        const { workspace } = await workspaceService.createWorkspace(user1, 'name');
        const { workspace: w2 } = await workspaceService.createWorkspace(user2, 'name');
        await workspaceService.addUserToWorkspace(workspace.id, user2.id);

        const chnls = await wdb.getWorkspaceChannels(workspace.id);
  
        // create tokens for user
        const tokens1 = await userService.createTokens(user1);
        const tokens2 = await userService.createTokens(user2);

        // connect second user from different devices
        const socket2a = io(server.info.uri);
        const socket2b = io(server.info.uri);
        let evtName = eventNames.socket.authSuccess;
        const awaitForAuth2a = awaitSocketForEvent(true, socket2a, evtName);
        const awaitForAuth2b = awaitSocketForEvent(true, socket2b, evtName);
        socket2a.emit(eventNames.client.auth, { 
          token: tokens2.accessToken,
          workspaceId: workspace.id
        });
        socket2b.emit(eventNames.client.auth, { 
          token: tokens2.accessToken,
          workspaceId: w2.id 
        });
        await Promise.all([awaitForAuth2a, awaitForAuth2b]);

        // prepare message object
        const message = { data: 'somedata' };

        // prepare promise for waiting message
        const checkMessageData = data => {
          expect(data.userId).equals(user1.id);
          expect(data.isResponseNeeded).equals(true);
          expect(data.message.data).equals(message.data);
        };
        evtName = eventNames.socket.invite;
        const waitForMessage2a = awaitSocketForEvent(true, socket2a, evtName, checkMessageData);
        const waitForMessage2b = awaitSocketForEvent(true, socket2b, evtName, checkMessageData);

        // send message to second user
        const response = await server.inject({
          method: 'POST',
          url: `/send-invite`,
          ...helpers.withAuthorization(tokens1),
          payload: {
            userId: user2.id,
            isResponseNeeded: true,
            message,
            workspaceId: workspace.id,
            channelId: chnls[0].id
          }
        });
        expect(response.statusCode).equals(200);
        const payload = JSON.parse(response.payload);
        expect(payload.inviteId).exists();

        await Promise.all([ waitForMessage2a, waitForMessage2b ]);

        socket2a.disconnect();
        socket2b.disconnect();
      });
    });
    describe('Try to send message for user that will not respond', () => {
      it('Sender should get a no-response-message event', async () => {
        const {
          userService,
          workspaceService,
          workspaceDatabaseService: wdb
        } = server.services();
        const user1 = await userService.signup({ email: 'user1@email.email', name: 'user1' });
        const user2 = await userService.signup({ email: 'user2@email.email', name: 'user2' });
  
        const { workspace } = await workspaceService.createWorkspace(user1, 'name');
        await workspaceService.addUserToWorkspace(workspace.id, user2.id);

        const chnls = await wdb.getWorkspaceChannels(workspace.id);
  
        // create tokens for user
        const tokens1 = await userService.createTokens(user1);
        const tokens2 = await userService.createTokens(user2);

        // connect second user from different devices
        const socket1 = io(server.info.uri);
        const socket2 = io(server.info.uri);
        let evtName = eventNames.socket.authSuccess;
        const awaitForAuth1 = awaitSocketForEvent(true, socket1, evtName);
        const awaitForAuth2 = awaitSocketForEvent(true, socket2, evtName);
        socket1.emit(eventNames.client.auth, { 
          token: tokens1.accessToken,
          workspaceId: workspace.id
        });
        socket2.emit(eventNames.client.auth, { 
          token: tokens2.accessToken,
          workspaceId: workspace.id 
        });
        await Promise.all([awaitForAuth1, awaitForAuth2]);

        // prepare message object
        const message = { data: 'somedata' };

        // send message to second user
        process.env.NO_MESSAGE_RESPONSE_TIMEOUT = 1;
        const response = await server.inject({
          method: 'POST',
          url: `/send-invite`,
          ...helpers.withAuthorization(tokens1),
          payload: {
            userId: user2.id,
            isResponseNeeded: true,
            message,
            workspaceId: workspace.id,
            channelId: chnls[0].id
          }
        });
        expect(response.statusCode).equals(200);
        const payload = JSON.parse(response.payload);
        expect(payload.inviteId).exists();

        // prepare promise for waiting no-response-event
        evtName = eventNames.socket.inviteResponse;
        const waitForNoResponse = awaitSocketForEvent(true, socket1, evtName, data => {
          expect(data.userId).equals(user2.id);
          expect(data.inviteId).equals(payload.inviteId);
          expect(data.response).equals('no-response');
        });

        await waitForNoResponse;

        socket1.disconnect();
        socket2.disconnect();
      });
    });
    describe('Send message to user and the user respond', () => {
      it('Sender should receive a response for his message', async () => {
        const {
          userService,
          workspaceService,
          workspaceDatabaseService: wdb
        } = server.services();
        const user1 = await userService.signup({ email: 'user1@email.email', name: 'user1' });
        const user2 = await userService.signup({ email: 'user2@email.email', name: 'user2' });
  
        const { workspace } = await workspaceService.createWorkspace(user1, 'name');
        await workspaceService.addUserToWorkspace(workspace.id, user2.id);

        const chnls = await wdb.getWorkspaceChannels(workspace.id);
  
        // create tokens for user
        const tokens1 = await userService.createTokens(user1);
        const tokens2 = await userService.createTokens(user2);

        // connect second user from different devices
        const socket1 = io(server.info.uri);
        const socket2 = io(server.info.uri);
        let evtName = eventNames.socket.authSuccess;
        const awaitForAuth1 = awaitSocketForEvent(true, socket1, evtName);
        const awaitForAuth2 = awaitSocketForEvent(true, socket2, evtName);
        socket1.emit(eventNames.client.auth, { 
          token: tokens1.accessToken,
          workspaceId: workspace.id
        });
        socket2.emit(eventNames.client.auth, { 
          token: tokens2.accessToken,
          workspaceId: workspace.id 
        });
        await Promise.all([awaitForAuth1, awaitForAuth2]);

        // prepare message object
        const message = { data: 'somedata' };
        const responseMessage = { data: 'response' };

        evtName = eventNames.socket.invite;
        const socket2WaitMessage = awaitSocketForEvent(true, socket2, evtName, data => {
          expect(data.userId).equals(user1.id);
        });

        // send message to second user
        process.env.NO_MESSAGE_RESPONSE_TIMEOUT = 200;
        const response = await server.inject({
          method: 'POST',
          url: `/send-invite`,
          ...helpers.withAuthorization(tokens1),
          payload: {
            userId: user2.id,
            isResponseNeeded: true,
            message,
            workspaceId: workspace.id,
            channelId: chnls[0].id
          }
        });
        expect(response.statusCode).equals(200);
        const payload = JSON.parse(response.payload);
        expect(payload.inviteId).exists();

        await socket2WaitMessage;

        // prepare promise that wait response
        evtName = eventNames.socket.inviteResponse;
        const socket1WaitResponse = awaitSocketForEvent(true, socket1, evtName, data => {
          expect(data.userId).equals(user2.id);
          expect(data.response.data).equals(responseMessage.data);
          expect(data.inviteId).equals(payload.inviteId);
        });

        // send response from second user
        const response2 = await server.inject({
          method: 'POST',
          url: '/invite-response',
          ...helpers.withAuthorization(tokens2),
          payload: {
            inviteId: payload.inviteId,
            response: responseMessage
          }
        });
        expect(response2.statusCode).equals(200);

        await socket1WaitResponse;

        socket1.disconnect();
        socket2.disconnect();
      });
    });
    describe('Send message with response needed and delete channel', () => {
      it('sender should not get no-response-message', async () => {
        const {
          userService,
          workspaceService,
          workspaceDatabaseService: wdb
        } = server.services();
        const user1 = await userService.signup({ email: 'user1@email.email', name: 'user1' });
        const user2 = await userService.signup({ email: 'user2@email.email', name: 'user2' });
  
        const { workspace } = await workspaceService.createWorkspace(user1, 'name');
        await workspaceService.addUserToWorkspace(workspace.id, user2.id);

        const chnls = await wdb.getWorkspaceChannels(workspace.id);
  
        // create tokens for user
        const tokens1 = await userService.createTokens(user1);
        const tokens2 = await userService.createTokens(user2);

        // connect sockets
        const socket1 = io(server.info.uri);
        const socket2 = io(server.info.uri);
        let evtName = eventNames.socket.authSuccess;
        const awaitForAuth1 = awaitSocketForEvent(true, socket1, evtName);
        const awaitForAuth2 = awaitSocketForEvent(true, socket2, evtName);
        socket1.emit(eventNames.client.auth, { 
          token: tokens1.accessToken,
          workspaceId: workspace.id
        });
        socket2.emit(eventNames.client.auth, { 
          token: tokens2.accessToken,
          workspaceId: workspace.id 
        });
        await Promise.all([awaitForAuth1, awaitForAuth2]);

        // prepare message object
        const message = { data: 'somedata' };

        // send message to second user
        process.env.NO_MESSAGE_RESPONSE_TIMEOUT = 40;
        const response = await server.inject({
          method: 'POST',
          url: `/send-invite`,
          ...helpers.withAuthorization(tokens1),
          payload: {
            userId: user2.id,
            isResponseNeeded: true,
            message,
            workspaceId: workspace.id,
            channelId: chnls[0].id
          }
        });
        expect(response.statusCode).equals(200);
        const payload = JSON.parse(response.payload);
        expect(payload.inviteId).exists();

        // wait that user1 not get no-response message
        evtName = eventNames.socket.inviteResponse;
        const waitForNoResponseNotFired = awaitSocketForEvent(false, socket1, evtName);

        await workspaceService.deleteChannel(chnls[0].id);

        await Promise.race([
          new Promise(resolve => setTimeout(resolve, 10)),
          waitForNoResponseNotFired
        ]);

        socket1.disconnect();
        socket2.disconnect();
      });
      it('receiver should get message-cancelled event', async () => {
        const {
          userService,
          workspaceService,
          workspaceDatabaseService: wdb
        } = server.services();
        const user1 = await userService.signup({ email: 'user1@email.email', name: 'user1' });
        const user2 = await userService.signup({ email: 'user2@email.email', name: 'user2' });
  
        const { workspace } = await workspaceService.createWorkspace(user1, 'name');
        await workspaceService.addUserToWorkspace(workspace.id, user2.id);

        const chnls = await wdb.getWorkspaceChannels(workspace.id);
  
        // create tokens for user
        const tokens1 = await userService.createTokens(user1);
        const tokens2 = await userService.createTokens(user2);

        // connect sockets
        const socket1 = io(server.info.uri);
        const socket2 = io(server.info.uri);
        let evtName = eventNames.socket.authSuccess;
        const awaitForAuth1 = awaitSocketForEvent(true, socket1, evtName);
        const awaitForAuth2 = awaitSocketForEvent(true, socket2, evtName);
        socket1.emit(eventNames.client.auth, { 
          token: tokens1.accessToken,
          workspaceId: workspace.id
        });
        socket2.emit(eventNames.client.auth, { 
          token: tokens2.accessToken,
          workspaceId: workspace.id 
        });
        await Promise.all([awaitForAuth1, awaitForAuth2]);

        // prepare message object
        const message = { data: 'somedata' };

        // send message to second user
        process.env.NO_MESSAGE_RESPONSE_TIMEOUT = 40;
        const response = await server.inject({
          method: 'POST',
          url: `/send-invite`,
          ...helpers.withAuthorization(tokens1),
          payload: {
            userId: user2.id,
            isResponseNeeded: true,
            message,
            workspaceId: workspace.id,
            channelId: chnls[0].id
          }
        });
        expect(response.statusCode).equals(200);
        const payload = JSON.parse(response.payload);
        expect(payload.inviteId).exists();

        // wait that user1 not get no-response message
        evtName = eventNames.socket.inviteResponse;
        const waitForNoResponseNotFired = awaitSocketForEvent(false, socket1, evtName);

        // wait the user2 get message-cancelled event
        evtName = eventNames.socket.inviteCancelled;
        const waitForMessageCancelled = awaitSocketForEvent(true, socket2, evtName, data => {
          expect(data.inviteId).equals(payload.inviteId);
        });

        await workspaceService.deleteChannel(chnls[0].id);

        await Promise.race([
          waitForMessageCancelled,
          waitForNoResponseNotFired
        ]);

        socket1.disconnect();
        socket2.disconnect();
      });
    });
    describe('Send message with response needed and user select channel manually', () => {
      it('sender should not get no-response-message', async () => {
        const {
          userService,
          workspaceService,
          workspaceDatabaseService: wdb
        } = server.services();
        const user1 = await userService.signup({ email: 'user1@email.email', name: 'user1' });
        const user2 = await userService.signup({ email: 'user2@email.email', name: 'user2' });
  
        const { workspace } = await workspaceService.createWorkspace(user1, 'name');
        await workspaceService.addUserToWorkspace(workspace.id, user2.id);

        const chnls = await wdb.getWorkspaceChannels(workspace.id);
  
        // create tokens for user
        const tokens1 = await userService.createTokens(user1);
        const tokens2 = await userService.createTokens(user2);

        // connect sockets
        const socket1 = io(server.info.uri);
        const socket2 = io(server.info.uri);
        let evtName = eventNames.socket.authSuccess;
        const awaitForAuth1 = awaitSocketForEvent(true, socket1, evtName);
        const awaitForAuth2 = awaitSocketForEvent(true, socket2, evtName);
        socket1.emit(eventNames.client.auth, { 
          token: tokens1.accessToken,
          workspaceId: workspace.id
        });
        socket2.emit(eventNames.client.auth, { 
          token: tokens2.accessToken,
          workspaceId: workspace.id 
        });
        await Promise.all([awaitForAuth1, awaitForAuth2]);

        // prepare message object
        const message = { data: 'somedata' };

        // send message to second user
        process.env.NO_MESSAGE_RESPONSE_TIMEOUT = 40;
        const response = await server.inject({
          method: 'POST',
          url: `/send-invite`,
          ...helpers.withAuthorization(tokens1),
          payload: {
            userId: user2.id,
            isResponseNeeded: true,
            message,
            workspaceId: workspace.id,
            channelId: chnls[0].id
          }
        });
        expect(response.statusCode).equals(200);
        const payload = JSON.parse(response.payload);
        expect(payload.inviteId).exists();

        // wait that user1 not get no-response message
        evtName = eventNames.socket.inviteResponse;
        const waitForNoResponseNotFired = awaitSocketForEvent(false, socket1, evtName);

        const selectChannelResponse = await server.inject({
          method: 'POST',
          url: `/channels/${chnls[0].id}/select?socketId=${socket2.id}`,
          payload: helpers.defaultUserState(),
          ...helpers.withAuthorization(tokens2),
        });
        expect(selectChannelResponse.statusCode).equals(200);

        await Promise.race([
          new Promise(resolve => setTimeout(resolve, 10)),
          waitForNoResponseNotFired
        ]);

        socket1.disconnect();
        socket2.disconnect();
      });
      it('receiver should get message-cancelled event', async () => {
        const {
          userService,
          workspaceService,
          workspaceDatabaseService: wdb
        } = server.services();
        const user1 = await userService.signup({ email: 'user1@email.email', name: 'user1' });
        const user2 = await userService.signup({ email: 'user2@email.email', name: 'user2' });
  
        const { workspace } = await workspaceService.createWorkspace(user1, 'name');
        await workspaceService.addUserToWorkspace(workspace.id, user2.id);

        const chnls = await wdb.getWorkspaceChannels(workspace.id);
  
        // create tokens for user
        const tokens1 = await userService.createTokens(user1);
        const tokens2 = await userService.createTokens(user2);

        // connect sockets
        const socket1 = io(server.info.uri);
        const socket2 = io(server.info.uri);
        let evtName = eventNames.socket.authSuccess;
        const awaitForAuth1 = awaitSocketForEvent(true, socket1, evtName);
        const awaitForAuth2 = awaitSocketForEvent(true, socket2, evtName);
        socket1.emit(eventNames.client.auth, { 
          token: tokens1.accessToken,
          workspaceId: workspace.id
        });
        socket2.emit(eventNames.client.auth, { 
          token: tokens2.accessToken,
          workspaceId: workspace.id 
        });
        await Promise.all([awaitForAuth1, awaitForAuth2]);

        // prepare message object
        const message = { data: 'somedata' };

        // send message to second user
        process.env.NO_MESSAGE_RESPONSE_TIMEOUT = 40;
        const response = await server.inject({
          method: 'POST',
          url: `/send-invite`,
          ...helpers.withAuthorization(tokens1),
          payload: {
            userId: user2.id,
            isResponseNeeded: true,
            message,
            workspaceId: workspace.id,
            channelId: chnls[0].id
          }
        });
        expect(response.statusCode).equals(200);
        const payload = JSON.parse(response.payload);
        expect(payload.inviteId).exists();

        // wait that user1 not get no-response message
        evtName = eventNames.socket.inviteResponse;
        const waitForNoResponseNotFired = awaitSocketForEvent(false, socket1, evtName);

        // wait the user2 get message-cancelled event
        evtName = eventNames.socket.inviteCancelled;
        const waitForMessageCancelled = awaitSocketForEvent(true, socket2, evtName, data => {
          expect(data.inviteId).equals(payload.inviteId);
        });

        const selectChannelResponse = await server.inject({
          method: 'POST',
          url: `/channels/${chnls[0].id}/select?socketId=${socket2.id}`,
          payload: helpers.defaultUserState(),
          ...helpers.withAuthorization(tokens2),
        });
        expect(selectChannelResponse.statusCode).equals(200);

        await Promise.race([
          waitForMessageCancelled,
          waitForNoResponseNotFired
        ]);

        socket1.disconnect();
        socket2.disconnect();
      });
    });
    describe('Try to send message several times', () => {
      it('Only one message should be sent', async () => {
        const {
          userService,
          workspaceService,
          workspaceDatabaseService: wdb
        } = server.services();
        const user1 = await userService.signup({ email: 'user1@email.email', name: 'user1' });
        const user2 = await userService.signup({ email: 'user2@email.email', name: 'user2' });
  
        const { workspace } = await workspaceService.createWorkspace(user1, 'name');
        await workspaceService.addUserToWorkspace(workspace.id, user2.id);

        const chnls = await wdb.getWorkspaceChannels(workspace.id);
  
        // create tokens for user
        const tokens1 = await userService.createTokens(user1);
        const tokens2 = await userService.createTokens(user2);

        // connect second user from different devices
        const socket1 = io(server.info.uri);
        const socket2 = io(server.info.uri);
        let evtName = eventNames.socket.authSuccess;
        const awaitForAuth1 = awaitSocketForEvent(true, socket1, evtName);
        const awaitForAuth2 = awaitSocketForEvent(true, socket2, evtName);
        socket1.emit(eventNames.client.auth, { 
          token: tokens1.accessToken,
          workspaceId: workspace.id
        });
        socket2.emit(eventNames.client.auth, { 
          token: tokens2.accessToken,
          workspaceId: workspace.id 
        });
        await Promise.all([awaitForAuth1, awaitForAuth2]);

        // prepare message object
        const message = { data: 'somedata' };

        // send message to second user
        process.env.NO_MESSAGE_RESPONSE_TIMEOUT = 100;
        const response1 = await server.inject({
          method: 'POST',
          url: `/send-invite`,
          ...helpers.withAuthorization(tokens1),
          payload: {
            userId: user2.id,
            isResponseNeeded: true,
            message,
            workspaceId: workspace.id,
            channelId: chnls[0].id
          }
        });
        const response2 = await server.inject({
          method: 'POST',
          url: `/send-invite`,
          ...helpers.withAuthorization(tokens1),
          payload: {
            userId: user2.id,
            isResponseNeeded: true,
            message,
            workspaceId: workspace.id,
            channelId: chnls[0].id
          }
        });
        expect(response1.statusCode).equals(200);
        expect(response2.statusCode).equals(200);
        expect(response1.result.inviteId).exists().equals(response2.result.inviteId);

        socket1.disconnect();
        socket2.disconnect();
      });
    });
  });

  describe('Testing private talks', () => {
    describe('Start private talk with two users', () => {
      it('Both users should receive message about created channel', async () => {
        const {
          userService,
          workspaceService
        } = server.services();
        const user1 = await userService.signup({ email: 'user1@email.email', name: 'user1' });
        const user2 = await userService.signup({ email: 'user2@email.email', name: 'user2' });
  
        const { workspace } = await workspaceService.createWorkspace(user1, 'name');
        await workspaceService.addUserToWorkspace(workspace.id, user2.id);
  
        // create tokens for user
        const tokens1 = await userService.createTokens(user1);
        const tokens2 = await userService.createTokens(user2);

        // connect both users
        const socket1 = io(server.info.uri);
        const socket2 = io(server.info.uri);
        let evtName = eventNames.socket.authSuccess;
        const awaitForAuth1 = awaitSocketForEvent(true, socket1, evtName);
        const awaitForAuth2 = awaitSocketForEvent(true, socket2, evtName);
        socket1.emit(eventNames.client.auth, { 
          token: tokens1.accessToken,
          workspaceId: workspace.id
        });
        socket2.emit(eventNames.client.auth, { 
          token: tokens2.accessToken,
          workspaceId: workspace.id 
        });
        await Promise.all([awaitForAuth1, awaitForAuth2]);

        // await events for new channel
        evtName = eventNames.socket.channelCreated;
        const awaitNewChannel1 = awaitSocketForEvent(true, socket1, evtName);
        const awaitNewChannel2 = awaitSocketForEvent(true, socket2, evtName);

        // start private talk from first user
        const startTalkResponse = await server.inject({
          method: 'POST',
          url: `/workspaces/${workspace.id}/private-talk`,
          ...helpers.withAuthorization(tokens1),
          payload: {
            users: [user2.id]
          }
        });
        expect (startTalkResponse.statusCode).equals(200);

        await Promise.all([awaitNewChannel1, awaitNewChannel2]);

        socket1.disconnect();
        socket2.disconnect();
      });
      it('Both users should be subscribed for event of this channel', async () => {
        const {
          userService,
          workspaceService
        } = server.services();
        const user1 = await userService.signup({ email: 'user1@email.email', name: 'user1' });
        const user2 = await userService.signup({ email: 'user2@email.email', name: 'user2' });
  
        const { workspace } = await workspaceService.createWorkspace(user1, 'name');
        await workspaceService.addUserToWorkspace(workspace.id, user2.id);
  
        // create tokens for user
        const tokens1 = await userService.createTokens(user1);
        const tokens2 = await userService.createTokens(user2);

        // connect both users
        const socket1 = io(server.info.uri);
        const socket2 = io(server.info.uri);
        let evtName = eventNames.socket.authSuccess;
        const awaitForAuth1 = awaitSocketForEvent(true, socket1, evtName);
        const awaitForAuth2 = awaitSocketForEvent(true, socket2, evtName);
        socket1.emit(eventNames.client.auth, { 
          token: tokens1.accessToken,
          workspaceId: workspace.id
        });
        socket2.emit(eventNames.client.auth, { 
          token: tokens2.accessToken,
          workspaceId: workspace.id 
        });
        await Promise.all([awaitForAuth1, awaitForAuth2]);

        // await events for new channel
        evtName = eventNames.socket.channelCreated;
        const awaitNewChannel1 = awaitSocketForEvent(true, socket1, evtName);
        const awaitNewChannel2 = awaitSocketForEvent(true, socket2, evtName);

        // start private talk from first user
        const startTalkResponse = await server.inject({
          method: 'POST',
          url: `/workspaces/${workspace.id}/private-talk`,
          ...helpers.withAuthorization(tokens1),
          payload: {
            users: [user2.id]
          }
        });
        expect (startTalkResponse.statusCode).equals(200);
        const payload = JSON.parse(startTalkResponse.payload);

        await Promise.all([awaitNewChannel1, awaitNewChannel2]);

        // second user selects the channel, the both should receive message about it
        evtName = eventNames.socket.userSelectedChannel;
        const checkFunc = data => {
          expect(data.channelId).equals(payload.channel.id);
        };
        const awaitUserSelected1 = awaitSocketForEvent(true, socket1, evtName, checkFunc);
        const awaitUserSelected2 = awaitSocketForEvent(true, socket2, evtName, checkFunc);
        const selectResponse = await server.inject({
          method: 'POST',
          url: `/channels/${payload.channel.id}/select?socketId=${socket2.id}`,
          ...helpers.withAuthorization(tokens2),
          payload: helpers.defaultUserState()
        });
        expect(selectResponse.statusCode).equals(200);
        await Promise.all([awaitUserSelected1, awaitUserSelected2]);

        socket1.disconnect();
        socket2.disconnect();
      });
      it('Second user should receive push message with invite', async () => {
        const {
          userService,
          workspaceService
        } = server.services();
        const user1 = await userService.signup({ email: 'user1@email.email', name: 'user1' });
        const user2 = await userService.signup({ email: 'user2@email.email', name: 'user2' });
  
        const { workspace } = await workspaceService.createWorkspace(user1, 'name');
        await workspaceService.addUserToWorkspace(workspace.id, user2.id);
  
        // create tokens for user
        const tokens1 = await userService.createTokens(user1);
        const tokens2 = await userService.createTokens(user2);

        // connect both users
        const socket1 = io(server.info.uri);
        const socket2 = io(server.info.uri);
        let evtName = eventNames.socket.authSuccess;
        const awaitForAuth1 = awaitSocketForEvent(true, socket1, evtName);
        const awaitForAuth2 = awaitSocketForEvent(true, socket2, evtName);
        socket1.emit(eventNames.client.auth, { 
          token: tokens1.accessToken,
          workspaceId: workspace.id
        });
        socket2.emit(eventNames.client.auth, { 
          token: tokens2.accessToken,
          workspaceId: workspace.id 
        });
        await Promise.all([awaitForAuth1, awaitForAuth2]);

        // await push message from 2nd socket
        const awaitPush = awaitSocketForEvent(true, socket2, eventNames.socket.invite, data => {
          expect(data.workspaceId).equals(workspace.id);
          expect(data.userId).equals(user1.id);
        });

        // start private talk from first user
        const startTalkResponse = await server.inject({
          method: 'POST',
          url: `/workspaces/${workspace.id}/private-talk`,
          ...helpers.withAuthorization(tokens1),
          payload: {
            users: [user2.id]
          }
        });
        expect (startTalkResponse.statusCode).equals(200);

        await awaitPush;

        socket1.disconnect();
        socket2.disconnect();
      });
    });
    describe('Invite third user in private channel', () => {
      it('The third user should be added to channel and receive invite', async () => {
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
  
        // create tokens for user
        const tokens1 = await userService.createTokens(user1);
        const tokens2 = await userService.createTokens(user2);
        const tokens3 = await userService.createTokens(user3);

        // connect all users
        const socket1 = io(server.info.uri);
        const socket2 = io(server.info.uri);
        const socket3 = io(server.info.uri);
        let evtName = eventNames.socket.authSuccess;
        const awaitForAuth1 = awaitSocketForEvent(true, socket1, evtName);
        const awaitForAuth2 = awaitSocketForEvent(true, socket2, evtName);
        const awaitForAuth3 = awaitSocketForEvent(true, socket3, evtName);
        socket1.emit(eventNames.client.auth, { 
          token: tokens1.accessToken,
          workspaceId: workspace.id
        });
        socket2.emit(eventNames.client.auth, { 
          token: tokens2.accessToken,
          workspaceId: workspace.id 
        });
        socket3.emit(eventNames.client.auth, { 
          token: tokens3.accessToken,
          workspaceId: workspace.id 
        });
        await Promise.all([awaitForAuth1, awaitForAuth2, awaitForAuth3]);

        // await events for new channel
        evtName = eventNames.socket.channelCreated;
        const awaitNewChannel1 = awaitSocketForEvent(true, socket1, evtName);
        const awaitNewChannel2 = awaitSocketForEvent(true, socket2, evtName);

        // start private talk from first user
        const startTalkResponse = await server.inject({
          method: 'POST',
          url: `/workspaces/${workspace.id}/private-talk`,
          ...helpers.withAuthorization(tokens1),
          payload: {
            users: [user2.id]
          }
        });
        expect (startTalkResponse.statusCode).equals(200);
        const privateTalkPayload = JSON.parse(startTalkResponse.payload);

        await Promise.all([awaitNewChannel1, awaitNewChannel2]);

        // send invite to private channel, wait both events 'invite' and 'channel-created'
        const awaitChannelCreated = awaitSocketForEvent(true, socket3, eventNames.socket.channelCreated);
        const awaitInvite = awaitSocketForEvent(true, socket3, eventNames.socket.invite);

        const sendInviteResponse = await server.inject({
          method: 'POST',
          url: `/send-invite`,
          ...helpers.withAuthorization(tokens1),
          payload: {
            userId: user3.id,
            isResponseNeeded: true,
            message: { type: 'invite' },
            channelId: privateTalkPayload.channel.id,
            workspaceId: workspace.id
          }
        });
        expect(sendInviteResponse.statusCode).equals(200);

        await Promise.all([awaitChannelCreated, awaitInvite]);

        socket1.disconnect();
        socket2.disconnect();
      });
    });
  });

  describe('Testing "Mute For All" feature', () => {
    describe('Send command about muting', () => {
      it('Addressee should receive event with proper socketId and fromUserId', async () => {
        const {
          userService,
          workspaceService,
          workspaceDatabaseService: wdb,
          channelService
        } = server.services();
        const user1 = await userService.signup({ email: 'user1@email.email', name: 'user1' });
        const user2 = await userService.signup({ email: 'user2@email.email', name: 'user2' });
  
        const { workspace } = await workspaceService.createWorkspace(user1, 'name');
        await workspaceService.addUserToWorkspace(workspace.id, user2.id);

        const chnls = await wdb.getWorkspaceChannels(workspace.id);
  
        // create tokens for user
        const tokens1 = await userService.createTokens(user1);
        const tokens2 = await userService.createTokens(user2);

        // connect second user from different devices
        const socket1 = io(server.info.uri);
        const socket2a = io(server.info.uri);
        const socket2b = io(server.info.uri);
        let evtName = eventNames.socket.authSuccess;
        const awaitForAuth1 = awaitSocketForEvent(true, socket1, evtName);
        const awaitForAuth2a = awaitSocketForEvent(true, socket2a, evtName);
        const awaitForAuth2b = awaitSocketForEvent(true, socket2b, evtName);
        socket1.emit(eventNames.client.auth, { 
          token: tokens1.accessToken,
          workspaceId: workspace.id
        });
        socket2a.emit(eventNames.client.auth, { 
          token: tokens2.accessToken,
          workspaceId: workspace.id
        });
        socket2b.emit(eventNames.client.auth, { 
          token: tokens2.accessToken,
          workspaceId: workspace.id 
        });
        await Promise.all([awaitForAuth1, awaitForAuth2a, awaitForAuth2b]);

        // select the channel for both users
        await channelService.selectChannel(chnls[0].id, user1.id, socket1.id, helpers.defaultUserState());
        await channelService.selectChannel(chnls[0].id, user2.id, socket2a.id, helpers.defaultUserState());

        // wait event from both 2-nd sockets about muting
        evtName = eventNames.socket.mutedForAll;
        const waitMutingCommand2a = awaitSocketForEvent(true, socket2a, evtName, data => {
          expect(data.fromUserId).equals(user1.id);
          expect(data.socketId).equals(socket2a.id);
        });
        const waitMutingCommand2b = awaitSocketForEvent(true, socket2b, evtName);

        // send POST command
        const response = await server.inject({
          method: 'POST',
          url: `/mute-for-all?socketId=${socket1.id}`,
          payload: {
            userId: user2.id
          },
          ...helpers.withAuthorization(tokens1)
        });
        expect(response.statusCode).equals(200);

        await Promise.all([
          waitMutingCommand2a,
          waitMutingCommand2b
        ]);

        socket2a.disconnect();
        socket2b.disconnect();
        socket1.disconnect();
      });
    });
  });

  describe('Testing when confidential data is changed', () => {
    describe('Testing when user detach social network from his account', () => {
      it('should receive an event about updated user', async () => {
        const {
          userService,
          workspaceService,
          userDatabaseService: udb,
        } = server.services();
        const user1 = await userService.signup({ email: 'user1@email.email', name: 'user1' });
        const user2 = await userService.signup({ email: 'user2@email.email', name: 'user2' });
  
        await udb.updateUser(user1.id, {
          auth: {
            facebook: {
              id: 'facebook-id'
            },
            slack: {
              id: 'slack-id'
            }
          }
        });
  
        const { workspace } = await workspaceService.createWorkspace(user1, 'name');
        await workspaceService.addUserToWorkspace(workspace.id, user2.id);
  
  
        // create tokens for user
        const tokens1 = await userService.createTokens(user1);
        const tokens2 = await userService.createTokens(user2);
  
        const socket1 = io(server.info.uri);
        const socket2 = io(server.info.uri);
        let evtName = eventNames.socket.authSuccess;
        const awaitForAuth1 = awaitSocketForEvent(true, socket1, evtName);
        const awaitForAuth2 = awaitSocketForEvent(true, socket2, evtName);
        socket1.emit(eventNames.client.auth, { 
          token: tokens1.accessToken,
          workspaceId: workspace.id
        });
        socket2.emit(eventNames.client.auth, { 
          token: tokens2.accessToken,
          workspaceId: workspace.id
        });
        await Promise.all([awaitForAuth1, awaitForAuth2]);
  
        // wait event that me updated
        evtName = eventNames.socket.meUpdated;
        const waitForMeUpdated = awaitSocketForEvent(true, socket1, evtName, data => {
          expect(data.user.socialAuth.facebook).exists();
          expect(data.user.socialAuth.slack).not.exists();
        });
        const waitForMeNotUpdated = awaitSocketForEvent(false, socket2, evtName);
  
        const response = await server.inject({
          method: 'GET',
          url: '/detach-account/slack',
          ...helpers.withAuthorization(tokens1)
        });
        expect(response.statusCode).equals(200);
        await Promise.race([waitForMeUpdated, waitForMeNotUpdated]);
  
        socket1.disconnect();
        socket2.disconnect();
      });
    });
  });

  describe('Testing kicking user from workspace', () => {
    describe('User in channel, admin kick him, check that everything is ok', () => {
      it('should delete user from channel, from workspace', async () => {
        const {
          userService,
          workspaceService,
          workspaceDatabaseService: wdb,
          channelService
        } = server.services();
  
        // register user and creator
        const creator = await userService.signup({ email: 'big_brother_is@watching.you' });
        const user = await userService.signup({ email: 'user@admin.ru' });
        const { workspace } = await workspaceService.createWorkspace(creator, 'w1');
        await workspaceService.addUserToWorkspace(workspace.id, user.id, 'user');
        const tokensUser = await userService.createTokens(user);
        const tokensCreator = await userService.createTokens(creator);
        const channels = await wdb.getWorkspaceChannels(workspace.id);
  
        // connect users to workspace
        const socket1 = io(server.info.uri);
        const socket2 = io(server.info.uri);
        let evtName = eventNames.socket.authSuccess;
        const awaitForAuth1 = awaitSocketForEvent(true, socket1, evtName);
        const awaitForAuth2 = awaitSocketForEvent(true, socket2, evtName);
        socket1.emit(eventNames.client.auth, { 
          token: tokensUser.accessToken,
          workspaceId: workspace.id
        });
        socket2.emit(eventNames.client.auth, { 
          token: tokensCreator.accessToken,
          workspaceId: workspace.id
        });
        await Promise.all([awaitForAuth1, awaitForAuth2]);
  
        // select channel
        await channelService.selectChannel(channels[0].id, user.id, socket1.id, helpers.defaultUserState());
  
        // wait that user will be disconnected
        const awaitDisconnected = awaitSocketForEvent(true, socket1, 'disconnect');
        evtName = eventNames.socket.kickedFromWorkspace;
        const awaitEventAboutKicking = awaitSocketForEvent(true, socket1, evtName, data => {
          expect(data.workspaceId).equals(workspace.id);
        });
        evtName = eventNames.socket.userLeavedWorkspace;        
        const awaitCreatorNotifiedAboutUserLeaved = awaitSocketForEvent(true, socket2, evtName, data => {
          expect(data.workspaceId).equals(workspace.id);
          expect(data.userId).equals(user.id);
        });
  
        // kick user
        const response = await server.inject({
          method: 'POST',
          url: '/admin/workspaces/revoke-access',
          payload: {
            workspaceId: workspace.id,
            userId: user.id
          },
          ...helpers.withAuthorization(tokensCreator),
        });
        expect(response.statusCode).equals(200);
        expect(response.payload).equals('ok');
  
        await Promise.all([
          awaitDisconnected,
          awaitEventAboutKicking,
          awaitCreatorNotifiedAboutUserLeaved
        ]);
  
        socket1.disconnect();
        socket2.disconnect();
      });
    });
  });

  describe('Testing updating workspace', () => {
    describe('Workspace is updated', () => {
      it('All users of that workspace should be notified', async () => {
        const {
          userService,
          workspaceService,
        } = server.services();
        const user1 = await userService.signup({ name: 'user1' });
        const user2 = await userService.signup({ name: 'user2' });
        const { workspace: w1 } = await workspaceService.createNewWorkspace(user1.id, {
          name: 'workspace1',
        });
        const { workspace: w2 } = await workspaceService.createNewWorkspace(user2.id, {
          name: 'workspace2',
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
          workspaceId: w2.id 
        });
        await Promise.all([awaitForAuth1, awaitForAuth2]);

        // update channel, wait for event
        const updateData = {
          name: 'new-name',
        };
        
        evtName = eventNames.socket.workspaceUpdated;
        const checkData = data => {
          expect(data.workspace.name).equals(updateData.name);
        };
        const updateChannelEvent1 = awaitSocketForEvent(true, socket1, evtName, checkData);
        const updateChannelEvent2NotFired = awaitSocketForEvent(false, socket2, evtName);

        await workspaceService.updateWorkspace(w1.id, updateData);

        await Promise.race([updateChannelEvent1, updateChannelEvent2NotFired]);

        socket1.disconnect();
        socket2.disconnect();
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
  pause = 100,
) {
  let stack = null;
  try {
    throw new Error();
  } catch(e) {
    stack = e.stack;
  }
  return new Promise((resolve, reject) => {
    let timeoutInterval = null;
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
          setTimeout(() => {
            try {
              clearInterval(timeoutInterval);
              timeoutInterval = null;
            } catch(e) {
              console.error(e);
            }
            resolve();
          }, pause);
        } catch(e) {
          clearInterval(timeoutInterval);
          timeoutInterval = null;
          reject(new Error(e + '\n' + stack.toString()));
        }
      });
    } else {
      /**
       * Если событие не должно быть вызвано,
       * то реджектимся, когда оно было отловлено
       */
      socket.once(event, () => {
        clearInterval(timeoutInterval);
        timeoutInterval = null;
        reject(new Error('Event shouldnt be fired' + '\n' + stack.toString()));
      });
    }

    setTimeout(() => {
      reject(new Error(`Timeout for waiting ${event} event` + '\n' + stack.toString()));
    }, 1800);
  });
}
