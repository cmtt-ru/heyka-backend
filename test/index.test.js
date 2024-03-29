'use strict';

const config = require('../config');
const Lab = require('@hapi/lab');
const { describe, it, before, beforeEach, after } = exports.lab = Lab.script();
const createServer = require('../server');
const { expect } = require('@hapi/code');
const uuid4 = require('uuid/v4');
const MockDate = require('mockdate');
const serviceHelpers = require('../lib/services/helpers');
const { methods: stubbedMethods } = require('./stub_external');
const helpers = require('./helpers');
const IMAGE_EXAMPLE = Buffer.from('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAACXBIWXMAA'
  + 'AGKAAABigEzlzBYAAAAB3RJTUUH5AQXDwEOjLBhqQAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVBkLmUHAAAALElEQVQI'
  + '1yXHsRHAQAzDMEbn/Sf0KBbvi6DDt7tt1STT9u5UIID6f4AkMwM8YOUadrVD1GUAAAAASUVORK5CYII=', 'base64');
const errorMessages = require('../lib/error_messages');
const jwt = require('jsonwebtoken');
const generateFakeConnection = (userId, workspaceId) => ({
  expiredAt: Date.now() + 15000,
  connectionId: uuid4(),
  userId,
  workspaceId,
  onlineStatus: 'online',
  localTime: 'GMT+3'
});

describe('Test routes', () => {
  let server = null;

  before(async () => {
    server = await createServer();
  });

  after(async () => {
    await server.redis.client.flushdb();
  });

  beforeEach(async () => {
    const db = server.plugins['hapi-pg-promise'].db;
    await db.query('DELETE FROM verification_codes');
    await db.query('DELETE FROM auth_links');
    await db.query('DELETE FROM users');
    await db.query('DELETE FROM sessions');
    await db.query('DELETE FROM channels');
    await db.query('DELETE FROM invites');
    await db.query('DELETE FROM workspaces');
    await db.query('DELETE FROM groups');
    await db.query('DELETE FROM groups_members');
    // clear all stubbed methods
    Object.values(stubbedMethods).forEach(func => func.resetHistory());
  });

  describe('GET /status (an unprotected route)', () => {
    it('returns "OK"', async () => {
      const response = await server.inject('/status');
      expect(response.statusCode).to.be.equal(200);
      expect(response.payload).to.be.equal('OK');
    });
  });

  describe('GET /protected', () => {
    describe('Without a bearer token', () => {
      it('returns 401 unauthorized error', async () => {
        const response = await server.inject('/protected');
        expect(response.statusCode).to.be.equal(401);
      });
    });

    describe('With an unexisted bearer token', () => {
      it('returns 401 unauthorized error', async () => {
        const response = await server.inject({
          method: 'GET',
          url: '/protected',
          headers: {
            'Authorization': 'Bearer AnUnexistedToken'
          }
        });
        expect(response.statusCode).to.be.equal(401);
      });
    });

    describe('With an expired bearer token', () => {
      it('returns 401 unauthorized error', async () => {
        const { userService } = server.services();
        const user = await userService.signup({ email: 'big_brother_is@watching.you' });
        const tokens = await userService.createTokens({ id: user.id }, -2019, -2019);
        const response = await server.inject({
          method: 'GET',
          url: '/protected',
          headers: {
            'Authorization': `Bearer ${tokens.accessToken}`
          }
        });
        expect(response.statusCode).to.be.equal(401);
        const payload = JSON.parse(response.payload);
        expect(payload.message).equals(errorMessages.accessTokenExpired);
      });
    });

    describe('With a valid bearer token', () => {
      it('returns 200 OK', async () => {
        const { userService } = server.services();
        const user = userService.signup({ email: 'but_you_can@hide.yourself' });
        const tokens = await userService.createTokens({ id: user.id }, 2019, 2019);
        const response = await server.inject({
          method: 'GET',
          url: '/protected',
          headers: {
            'Authorization': `Bearer ${tokens.accessToken}`
          }
        });
        expect(response.statusCode).to.be.equal(200);
        expect(response.payload).to.be.equal('OK');
      });
    });
  });

  /**
   * Authentication
   */
  describe('POST /signin', () => {
    describe('sign in with an invalid email', () => {
      it('returns 401', async () => {
        const response = await server.inject({
          method: 'POST',
          url: '/signin',
          payload: { credentials: { email: 'admin@example.com', password: 'qwerty' } }
        });
        expect(response.statusCode).to.be.equal(401);
        expect(response.payload).includes('Email or password are invalid');
      });
    });

    describe('sign in with valid email but invalid password', () => {
      it('return 401', async () => {
        const { userService } = server.services();
        await userService.signup({ email: 'admin@example.com', password: 'qwerty' });
        const response = await server.inject({
          method: 'POST',
          url: '/signin',
          payload: { credentials: { email: 'admin@example.com', password: 'not qwerty' } }
        });
        expect(response.statusCode).to.be.equal(401);
        expect(response.payload).includes('Email or password are invalid');
      });
    });

    describe('sign in with valid credentials', () => {
      it('returns user info and tokens', async () => {
        const { userService } = server.services();
        await userService.signup({ email: 'admin@example.com', password: 'qwerty', name: '1' });
        const response = await server.inject({
          method: 'POST',
          url: '/signin',
          payload: { credentials: { email: 'admin@example.com', password: 'qwerty' } }
        });
        expect(response.statusCode).to.be.equal(200);
        const payload = JSON.parse(response.payload);
        expect(payload.credentials).includes('accessToken');
        expect(payload.credentials).includes('refreshToken');
        expect(payload.user).includes('id');
        expect(await userService.findAccessToken(payload.credentials.accessToken)).to.be.an.object();
        expect(await userService.findRefreshToken(payload.credentials.refreshToken)).to.be.an.object();
      });
    });
  });

  describe('POST /signup', () => {
    describe('sign up with an existed email', () => {
      it('returns 401', async () => {
        const userPayload = { email: 'admin@example.com', password: 'qwerty', name: 'randomName' };
        await server.services().userService.signup(userPayload);
        const response = await server.inject({
          method: 'POST',
          url: '/signup',
          payload: { user: userPayload }
        });
        expect(response.statusCode).to.be.equal(400);
      });
    });

    describe('sign up with valid credentials', () => {
      it('creates user and returns tokens', async () => {
        const { userService } = server.services();
        const response = await server.inject({
          method: 'POST',
          url: '/signup',
          payload: { user: { email: 'admin@example.com', password: 'qwerty', name: 'randomName' } }
        });
        expect(response.statusCode).to.be.equal(200);
        const payload = JSON.parse(response.payload);
        expect(payload.credentials).includes('accessToken');
        expect(payload.credentials).includes('refreshToken');
        expect(payload.user).includes('id');
        expect(await userService.findAccessToken(payload.credentials.accessToken)).to.be.an.object();
        expect(await userService.findRefreshToken(payload.credentials.refreshToken)).to.be.an.object();
      });
      it('call "sendEmail" stubbed method (email with verification code is sent', async () => {
        const email = 'admin@example.com';
        const response = await server.inject({
          method: 'POST',
          url: '/signup',
          payload: { user: { email, password: 'qwerty', name: 'randomName' } }
        });
        expect(response.statusCode).to.be.equal(200);
        // check that email is sent
        expect(stubbedMethods.sendEmail.calledOnce).true();
        expect(stubbedMethods.sendEmail.args[0][0][0].email).equals(email);
      });
    });
  });

  describe('POST /signout', () => {
    describe('Signout out from one session', () => {
      it('Cant use this session anymore', async () => {
        const { userService } = server.services();
        const user = await userService.signup({
          name: 'name',
          email: 'email@email.email',
          password: 'password',
        });
        const tokens1 = await userService.createTokens(user);
        const tokens2 = await userService.createTokens(user);

        const response = await server.inject({
          method: 'POST',
          url: '/signout',
          ...helpers.withAuthorization(tokens1),
        });
        expect(response.statusCode).to.be.equal(200);
        expect(response.payload).equals('ok');

        const response2 = await server.inject({
          method: 'GET',
          url: '/protected',
          ...helpers.withAuthorization(tokens1),
        });
        expect(response2.statusCode).equals(401);

        const response3 = await server.inject({
          method: 'GET',
          url: '/protected',
          ...helpers.withAuthorization(tokens2),
        });
        expect(response3.statusCode).equals(200);
      });
    });
  });

  describe('POST /refresh-token', () => {
    describe('Incorrect request without tokens', () => {
      it('Should return 400 Bad Request', async () => {
        const response = await server.inject({
          method: 'POST',
          url: '/refresh-token',
          payload: {}
        });
        expect(response.statusCode).to.be.equal(400);
      });
    });

    describe('Request with tokens that doesnt exist', () => {
      it('should return 401 Unauthorized request', async () => {
        const accessToken = uuid4();
        const refreshToken = uuid4();
        const response = await server.inject({
          method: 'POST',
          url: '/refresh-token',
          payload: { accessToken, refreshToken }
        });
        expect(response.statusCode).to.be.equal(401);
      });
    });

    describe('Request with valid refresh token but with invalid access token', () => {
      it('Should return 401 Unauthorized request', async () => {
        const { userService } = server.services();
        const user = await userService.signup({ email: 'funny@chel.ru' });
        const tokens = await userService.createTokens(user);
        const response = await server.inject({
          method: 'POST',
          url: '/refresh-token',
          payload: { accessToken: uuid4(), refreshToken: tokens.refreshToken }
        });
        expect(response.statusCode).to.be.equal(401);
      });
    });

    describe('Request with expired refresh token', () => {
      it('Should return 401 Unauthorized request', async () => {
        const { userService } = server.services();
        const user = await userService.signup({ email: 'funny@chel.ru' });
        const tokens = await userService.createTokens(user, 10000, -10000);
        const response = await server.inject({
          method: 'POST',
          url: '/refresh-token',
          payload: { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken }
        });
        expect(response.statusCode).to.be.equal(401);
      });
    });

    describe('Request with valid tokens', () => {
      it('Should return new tokens and delete previous old ones', async () => {
        const { userService } = server.services();
        const user = await userService.signup({ email: 'funny@chel.ru' });
        const tokens = await userService.createTokens(user, 10000, 10000);
        const response = await server.inject({
          method: 'POST',
          url: '/refresh-token',
          payload: { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken }
        });
        expect(response.statusCode).to.be.equal(200);
        const response2 = await server.inject({
          method: 'POST',
          url: '/refresh-token',
          payload: { accessToken: response.result.accessToken, refreshToken: response.result.refreshToken }
        });
        expect(response2.statusCode).to.be.equal(200);
        const payload = JSON.parse(response2.payload);
        expect(payload).includes('accessToken');
        expect(payload).includes('refreshToken');
        /**
         * Old tokens saved because of bug https://cmtt-ru.atlassian.net/browse/HEYK-903
         */
        //expect(await userService.findAccessToken(tokens.accessToken)).to.be.null();
        //expect(await userService.findRefreshToken(tokens.refreshToken)).to.be.null();
      });
    });

    describe('HEYK-903: Case when server updates token, but client didnt receive them', () => {
      it('Previous token should be valid until user will send new ones', async () => {
        const { userService } = server.services();
        const user = await userService.signup({ name: 'hey', email: 'funny@chel.ru' });
        const tokens = await userService.createTokens(user, 10000, 10000);
        const response1 = await server.inject({
          method: 'GET',
          url: '/me',
          ...helpers.withAuthorization(tokens),
        });
        expect(response1.statusCode).equals(200);

        // refresh token
        const response2 = await server.inject({
          method: 'POST',
          url: '/refresh-token',
          payload: { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken }
        });
        expect(response2.statusCode).to.be.equal(200);

        // previous accesss/refresh token still valid
        const response3 = await server.inject({
          method: 'GET',
          url: '/me',
          ...helpers.withAuthorization(tokens),
        });
        expect(response3.statusCode).equals(200);

        // refresh token works with previous access/refresh token
        const response4 = await server.inject({
          method: 'POST',
          url: '/refresh-token',
          payload: { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken }
        });
        expect(response4.statusCode).to.be.equal(200);

        // refresh token with the fresh pair
        const response5 = await server.inject({
          method: 'POST',
          url: '/refresh-token',
          payload: { accessToken: response4.result.accessToken, refreshToken: response4.result.refreshToken }
        });
        expect(response5.statusCode).to.be.equal(200);

        // old tokens not valid
        const response6 = await server.inject({
          method: 'GET',
          url: '/me',
          ...helpers.withAuthorization(tokens),
        });
        expect(response6.statusCode).equals(401);
      });
    });
  });

  /**
   * Users
   */
  describe('POST /profile', () => {
    describe('update profile with a valid data', () => {
      it('should update user profile data', async () => {
        const {
          userService,
          userDatabaseService: udb
        } = server.services();

        const oldName = 'oldName';
        const user = await userService.signup({ email: 'admin@admin.ru', name: oldName });
        const tokens = await userService.createTokens(user);

        const newName = 'newName';
        const avatar = 'https://leonardo.osnova.io/6be46ea9-d042-19cb-a130-bb4e5add21eb/';
        const response = await server.inject({
          method: 'POST',
          url: '/profile',
          ...helpers.withAuthorization(tokens),
          payload: {
            name: newName,
            avatar
          }
        });
        expect(response.statusCode).equals(200);
        const newUser = await udb.findById(user.id);
        expect(newUser.name).equals(newName);
        expect(newUser.avatar).equals(avatar);
      });
    });
    describe('update profile and pass a not leonardo avatar', () => {
      it('should download avatar from url and upload to leonardo', async () => {
        const {
          userService,
          userDatabaseService: udb
        } = server.services();

        const oldName = 'oldName';
        const user = await userService.signup({ email: 'admin@admin.ru', name: oldName });
        const tokens = await userService.createTokens(user);

        const newName = 'newName';
        const avatar = 'http://some-picture.from/external/internet.jpg';
        const response = await server.inject({
          method: 'POST',
          url: '/profile',
          ...helpers.withAuthorization(tokens),
          payload: {
            name: newName,
            avatar
          }
        });
        expect(response.statusCode).equals(200);
        const newUser = await udb.findById(user.id);
        expect(newUser.name).equals(newName);
        expect(newUser.avatar).contain('leonardo.osnova.io');
        expect(stubbedMethods.uploadImageFromUrl.calledOnce).true();
      });
    });
    describe('pass null avatar_file_id to clear avatar', () => {
      it('file should be deleted in S3, avatar fields should be empty', async () => {
        const {
          userService,
          userDatabaseService: udb,
          fileDatabaseService: fdb,
        } = server.services();

        const user = await userService.signup({ email: 'admin@admin.ru', name: 'name' });
        const file = {
          id: uuid4(),
          filename: uuid4(),
          user_id: user.id,
          type: 'avatar',
          created_at: new Date(),
          updated_at: new Date(),
        };
        await fdb.insertFile(file);
        await udb.updateUser(user.id, {
          avatar_file_id: file.id,
          avatar_set: {
            example: '1'
          },
        });
        const tokens = await userService.createTokens(user);

        const response = await server.inject({
          method: 'POST',
          url: '/profile',
          ...helpers.withAuthorization(tokens),
          payload: {
            avatarFileId: null,
          }
        });
        expect(response.statusCode).equals(200);
        const newUser = await udb.findById(user.id);
        expect(newUser.avatar_file_id).not.exists();
        expect(newUser.avatar_set).equals({});
        const notFile = await fdb.getFileById(file.id);
        expect(notFile).not.exists();
      });
    });
    describe('change email', () => {
      it('email with verification code should be sent', async () => {
        const {
          userService,
        } = server.services();

        const user = await userService.signup({ email: 'admin@admin.ru', name: 'name' });
        const tokens = await userService.createTokens(user);

        const response = await server.inject({
          method: 'POST',
          url: '/profile',
          ...helpers.withAuthorization(tokens),
          payload: {
            email: 'new@admin.ru',
          }
        });
        expect(response.statusCode).equals(200);
        expect(stubbedMethods.sendEmail.calledTwice).true();
      });
    });
  });

  describe('GET /me', () => {
    describe('Get current user', () => {
      it('should return current authenticated user', async () => {
        const {
          userService
        } = server.services();
        const userInfo = {
          name: 'test',
          email: 'testEmail@mail.ru'
        };
        const user = await userService.signup(userInfo);
        const tokens = await userService.createTokens(user);
        const response = await server.inject({
          method: 'GET',
          url: '/me',
          ...helpers.withAuthorization(tokens)
        });
        expect(response.statusCode).equals(200);
        const payload = JSON.parse(response.payload);
        expect(payload.id).equals(user.id);
        expect(payload.email).equals(userInfo.email);
      });
    });
  });

  describe('POST /me/app-settings', () => {
    describe('Just check route', () => {
      it('should return 200 and new updated user', async () => {
        const {
          userService,
          userDatabaseService: udb
        } = server.services();

        const user = await userService.signup({ name: 'user' });
        const tokens = await userService.createTokens(user);
        const newAppSettings = {
          theme: 'dark',
        };

        const response = await server.inject({
          method: 'POST',
          url: '/me/app-settings',
          ...helpers.withAuthorization(tokens),
          payload: newAppSettings,
        });
        expect(response.statusCode).equals(200);
        expect(response.result.appSettings).exists();
        expect(response.result.appSettings.theme).equals(newAppSettings.theme);
        const newUser = await udb.findById(user.id);
        expect(newUser.app_settings.theme).equals(newAppSettings.theme);
      });
    });
  });
  describe('DELETE /me', () => {

    describe('Cant delete if there are workspaces where user is admin', () => {
      it('should return 400 bad request', async () => {
        const {
          userService,
          workspaceService,
        } = server.services();
        const userInfo = {
          name: 'test',
          email: 'testEmail@mail.ru',
        };
        const user = await userService.signup(userInfo);
        await workspaceService.createWorkspace(user, 'test');
        const tokens = await userService.createTokens(user);
        const response = await server.inject({
          method: 'POST',
          url: '/me/delete',
          payload: {
          },
          ...helpers.withAuthorization(tokens)
        });
        expect(response.statusCode).equals(400);
      });
    });
    describe('Delete account', () => {
      it('Check that user leaved workspace when delete account', async () => {
        const {
          userService,
          workspaceService,
          workspaceDatabaseService: wdb,
        } = server.services();
        const userInfo = {
          name: 'test',
          email: 'testEmail@mail.ru',
        };
        const user = await userService.signup(userInfo);
        const admin = await userService.signup({ name: 'admin', email: 'admin@admin.ru' });
        const { workspace: w } = await workspaceService.createWorkspace(admin, 'test');
        await workspaceService.addUserToWorkspace(w.id, user.id, 'user');
        const tokens = await userService.createTokens(user);
        const response = await server.inject({
          method: 'POST',
          url: '/me/delete',
          ...helpers.withAuthorization(tokens)
        });
        expect(response.statusCode).equals(200);
        const allWorkspaceMembers = await wdb.getWorkspaceMembers(w.id);
        expect(allWorkspaceMembers).length(1);
        expect(allWorkspaceMembers[0].id).equals(admin.id);
      });
    });
  });

  describe('POST /image', () => {
    describe('User tries to upload image without files', () => {
      it('should return an error', async () => {
        const { userService } = server.services();
        const user = await userService.signup({ email: 'u@example.org', name: 'UserExample' });
        const tokens = await userService.createTokens(user);
        const response = await server.inject({
          method: 'POST',
          url: '/image',
          ...helpers.withAuthorization(tokens)
        });
        expect(response.statusCode).equals(415);
      });
    });
    describe('User tries to upload file in unsupported media type', () => {
      it('should return an error', async () => {
        const { userService } = server.services();
        const user = await userService.signup({ email: 'u@example.org', name: 'UserExample' });
        const tokens = await userService.createTokens(user);
        const withAuth = helpers.withAuthorization(tokens);
        withAuth.headers['Content-Type'] = 'multipart/form-data; boundary=TEST';
        const payload = '--TEST\r\n'
          + 'Content-Disposition: form-data; name="image"; filename="text.txt"\r\n'
          + 'Content-Type: text/plain\r\n\r\n'
          + 'just plain text\r\n'
          + '--TEST\r\n';
        const response = await server.inject({
          method: 'POST',
          url: '/image',
          ...withAuth,
          payload
        });
        expect(response.statusCode).equals(415);
      });
    });
    describe('Upload a valid image', () => {
      it('should return url of image', async () => {
        const { userService } = server.services();
        const user = await userService.signup({ email: 'u@example.org', name: 'UserExample' });
        const tokens = await userService.createTokens(user);
        const withAuth = helpers.withAuthorization(tokens);
        withAuth.headers['Content-Type'] = 'multipart/form-data; boundary=TEST';
        const payload = '--TEST\r\n'
          + 'Content-Disposition: form-data; name="image"; filename="image/png\r\n'
          + 'Content-Type: image/png\r\n\r\n'
          + IMAGE_EXAMPLE.toString() + '\r\n'
          + '--TEST\r\n';
        const response = await server.inject({
          method: 'POST',
          url: '/image',
          ...withAuth,
          payload
        });
        expect(response.statusCode).equals(200);
        const result = JSON.parse(response.payload);
        expect(result.image32x32).exists();
      });
    });
  });

  describe('GET /check-permissions', () => {
    describe('Check permissions when everything goes right', () => {
      it('admin user wants to update and delete channel, should return list of true', async () => {
        const {
          userService,
          workspaceService,
          workspaceDatabaseService: wdb
        } = server.services();
        const userInfo = {
          name: 'test',
          email: 'testEmail@mail.ru'
        };
        const user = await userService.signup(userInfo);
        const { workspace } = await workspaceService.createWorkspace(user, 'test');
        const channels = await wdb.getWorkspaceChannels(workspace.id);
        const tokens = await userService.createTokens(user);
        const response = await server.inject({
          method: 'GET',
          url: `/check-permissions?actions=channel.delete,channel.update&channelId=${channels[0].id}`,
          ...helpers.withAuthorization(tokens)
        });
        expect(response.statusCode).equals(200);
        const payload = JSON.parse(response.payload);
        expect(payload['channel.update']).true();
        expect(payload['channel.delete']).true();
      });
    });
    describe('Check permissions when an action is permitted but another isnt', () => {
      it('should return payload with different results for different actions', async () => {
        const {
          userService,
          workspaceService,
          workspaceDatabaseService: wdb
        } = server.services();
        const userInfo = {
          name: 'test',
          email: 'testEmail@mail.ru'
        };
        const user = await userService.signup(userInfo);
        const anotherUser = await userService.signup({ name: 'test2', email: 'test2@mail.ru' });
        const { workspace } = await workspaceService.createWorkspace(user, 'test');
        const { workspace: anotherWorkspace } = await workspaceService.createWorkspace(anotherUser, 'test2');
        const channels = await wdb.getWorkspaceChannels(workspace.id);
        const tokens = await userService.createTokens(user);
        const response = await server.inject({
          method: 'GET',
          url: `/check-permissions?actions=channel.delete,workspace.createChannel`
            + `&channelId=${channels[0].id}&workspaceId=${anotherWorkspace.id}`,
          ...helpers.withAuthorization(tokens)
        });
        expect(response.statusCode).equals(200);
        const payload = JSON.parse(response.payload);
        expect(payload['channel.delete']).true();
        expect(payload['workspace.createChannel']).false();
      });
    });
    describe('Send action which not exists', () => {
      it('should return 400 and object with errors', async () => {
        const {
          userService,
          workspaceService,
        } = server.services();
        const userInfo = {
          name: 'test',
          email: 'testEmail@mail.ru'
        };
        const user = await userService.signup(userInfo);
        const { workspace } = await workspaceService.createWorkspace(user, 'test');
        const tokens = await userService.createTokens(user);
        const response = await server.inject({
          method: 'GET',
          url: `/check-permissions?actions=workspace.makeEverybodyHappier&workspaceId=${workspace.id}`,
          ...helpers.withAuthorization(tokens)
        });
        expect(response.statusCode).equals(400);
        const payload = JSON.parse(response.payload);
        expect(payload.data['workspace.makeEverybodyHappier']).equals('Unknow action');
      });
    });
    describe('Send action without corresponding entityId', () => {
      it('should return 400 and object with errors', async () => {
        const {
          userService,
          workspaceService,
        } = server.services();
        const userInfo = {
          name: 'test',
          email: 'testEmail@mail.ru'
        };
        const user = await userService.signup(userInfo);
        const { workspace } = await workspaceService.createWorkspace(user, 'test');
        const tokens = await userService.createTokens(user);
        const response = await server.inject({
          method: 'GET',
          url: `/check-permissions?actions=workspace.createChannel,channel.delete&workspaceId=${workspace.id}`,
          ...helpers.withAuthorization(tokens)
        });
        expect(response.statusCode).equals(400);
        const payload = JSON.parse(response.payload);
        expect(payload.data['channel.delete']).equals('Query parameter "channelId" is required');
      });
    });
    describe('Send action without corresponding entityId and send unknow action', () => {
      it('should return 400 and object with errors', async () => {
        const {
          userService,
        } = server.services();
        const userInfo = {
          name: 'test',
          email: 'testEmail@mail.ru'
        };
        const user = await userService.signup(userInfo);
        const tokens = await userService.createTokens(user);
        const response = await server.inject({
          method: 'GET',
          url: `/check-permissions?actions=workspace.makeEverybodyHappier,channel.delete`,
          ...helpers.withAuthorization(tokens)
        });
        expect(response.statusCode).equals(400);
        const payload = JSON.parse(response.payload);
        expect(payload.data['channel.delete']).equals('Query parameter "channelId" is required');
        expect(payload.data['workspace.makeEverybodyHappier']).equals('Unknow action');
      });
    });
  });

  describe('POST /reset-password/init', () => {
    describe('Reset password, init process', () => {
      it('Valid email: should return 200 OK, email should be sent', async () => {
        const {
          userService,
          userDatabaseService: udb
        } = server.services();
        const userInfo = {
          name: 'test',
          email: 'testEmail@mail.ru',
        };
        const user = await userService.signup(userInfo);
        await udb.updateUser(user.id, { is_email_verified: true });
        const response = await server.inject({
          method: 'POST',
          url: `/reset-password/init`,
          payload: {
            email: 'testEmail@mail.ru'
          }
        });
        expect(response.statusCode).equals(200);
        expect(response.payload).equals('ok');
        expect(stubbedMethods.sendResetPasswordToken.calledOnce).true();
        const args = stubbedMethods.sendResetPasswordToken.args[0][0];
        expect(args[0].id).equals(user.id);
      });
      it('Email not found: should return 200 OK, email should not be sent', async () => {
        const {
          userService,
          userDatabaseService: udb
        } = server.services();
        const userInfo = {
          name: 'test',
          email: 'testEmail@mail.ru',
        };
        const user = await userService.signup(userInfo);
        await udb.updateUser(user.id, { is_email_verified: true });
        const response = await server.inject({
          method: 'POST',
          url: `/reset-password/init`,
          payload: {
            email: 'another.email@mail.ru'
          }
        });
        expect(response.statusCode).equals(200);
        expect(response.payload).equals('ok');
        expect(stubbedMethods.sendResetPasswordToken.calledOnce).false();
      });
      it('Email not verified: should return 200 OK, email should not be sent', async () => {
        const {
          userService,
        } = server.services();
        const userInfo = {
          name: 'test',
          email: 'testEmail@mail.ru',
        };
        await userService.signup(userInfo);
        const response = await server.inject({
          method: 'POST',
          url: `/reset-password/init`,
          payload: {
            email: 'another.email@mail.ru'
          }
        });
        expect(response.statusCode).equals(200);
        expect(response.payload).equals('ok');
        expect(stubbedMethods.sendResetPasswordToken.calledOnce).false();
      });
    });
  });

  describe('POST /reset-password', () => {
    describe('Init process, reset password with valid token', () => {
      it('should return "ok" and change password', async () => {
        const {
          userService,
          userDatabaseService: udb
        } = server.services();
        const userInfo = {
          name: 'test',
          email: 'admin@mail.ru',
        };
        const user = await userService.signup(userInfo);
        await udb.updateUser(user.id, { is_email_verified: true });
        const response = await server.inject({
          method: 'POST',
          url: `/reset-password/init`,
          payload: {
            email: 'admin@mail.ru'
          }
        });
        expect(response.statusCode).equals(200);
        expect(response.payload).equals('ok');
        expect(stubbedMethods.sendResetPasswordToken.calledOnce).true();
        const args = stubbedMethods.sendResetPasswordToken.args[0][0];
        expect(args[0].id).equals(user.id);

        const token = args[1];

        const response2 = await server.inject({
          method: 'POST',
          url: '/reset-password',
          payload: {
            token,
            password: 'new-password'
          }
        });
        expect(response2.statusCode).equals(200);

        // try signin with new password
        await userService.signin({
          email: 'admin@mail.ru',
          password: 'new-password'
        });
      });
    });
    describe('Init process, reset password with expired token', () => {
      it('Simulate a day spent, should return invalid token', async () => {
        const {
          userService,
          userDatabaseService: udb
        } = server.services();
        const userInfo = {
          name: 'test',
          email: 'admin@mail.ru',
          password: 'old-password',
        };
        const user = await userService.signup(userInfo);
        await udb.updateUser(user.id, { is_email_verified: true });
        const response = await server.inject({
          method: 'POST',
          url: `/reset-password/init`,
          payload: {
            email: 'admin@mail.ru'
          }
        });
        expect(response.statusCode).equals(200);
        expect(response.payload).equals('ok');
        expect(stubbedMethods.sendResetPasswordToken.calledOnce).true();
        const args = stubbedMethods.sendResetPasswordToken.args[0][0];
        expect(args[0].id).equals(user.id);

        const token = args[1];

        MockDate.set(Date.now() + 24 * 60 * 60 * 1000 + 1);
        const response2 = await server.inject({
          method: 'POST',
          url: '/reset-password',
          payload: {
            token,
            password: 'new-password'
          }
        });
        MockDate.reset();
        expect(response2.statusCode).equals(400);


        // try signin with old password
        await userService.signin({
          email: 'admin@mail.ru',
          password: 'old-password',
        });
      });
    });
    describe('Init process, reset password and ensure, that token can be used single time', () => {
      it('For second time an error should be returned', async () => {
        const {
          userService,
          userDatabaseService: udb
        } = server.services();
        const userInfo = {
          name: 'test',
          email: 'admin@mail.ru',
          password: 'old-password',
        };
        const user = await userService.signup(userInfo);
        await udb.updateUser(user.id, { is_email_verified: true });
        const response = await server.inject({
          method: 'POST',
          url: `/reset-password/init`,
          payload: {
            email: 'admin@mail.ru'
          }
        });
        expect(response.statusCode).equals(200);
        expect(response.payload).equals('ok');
        expect(stubbedMethods.sendResetPasswordToken.calledOnce).true();
        const args = stubbedMethods.sendResetPasswordToken.args[0][0];
        expect(args[0].id).equals(user.id);

        const token = args[1];

        const response2 = await server.inject({
          method: 'POST',
          url: '/reset-password',
          payload: {
            token,
            password: 'new-password'
          }
        });
        expect(response2.statusCode).equals(200);


        // try signin with new password
        await userService.signin({
          email: 'admin@mail.ru',
          password: 'new-password',
        });

        // try to reset one more time
        const response3 = await server.inject({
          method: 'POST',
          url: '/reset-password',
          payload: {
            token,
            password: 'new-password-second-time'
          }
        });
        expect(response3.statusCode).equals(400);


        // try signin with new-old password
        await userService.signin({
          email: 'admin@mail.ru',
          password: 'new-password',
        });
      });
    });
    describe('Init process, reset password and ensure, that all user sessions are discarded', () => {
      it('For second time an error should be returned', async () => {
        const {
          userService,
          userDatabaseService: udb
        } = server.services();
        const userInfo = {
          name: 'test',
          email: 'admin@mail.ru',
          password: 'old-password',
        };
        const user = await userService.signup(userInfo);
        const tokens1 = await userService.createTokens(user);
        const tokens2 = await userService.createTokens(user);
        await udb.updateUser(user.id, { is_email_verified: true });
        const response = await server.inject({
          method: 'POST',
          url: `/reset-password/init`,
          payload: {
            email: 'admin@mail.ru'
          }
        });
        expect(response.statusCode).equals(200);
        expect(response.payload).equals('ok');
        expect(stubbedMethods.sendResetPasswordToken.calledOnce).true();
        const args = stubbedMethods.sendResetPasswordToken.args[0][0];
        expect(args[0].id).equals(user.id);

        const token = args[1];

        // try to use tokens created before password resetting
        const response2 = await server.inject({
          method: 'GET',
          url: '/protected',
          ...helpers.withAuthorization(tokens1),
        });
        const response3 = await server.inject({
          method: 'GET',
          url: '/protected',
          ...helpers.withAuthorization(tokens2),
        });
        expect(response2.statusCode).equals(200);
        expect(response3.statusCode).equals(200);

        const response4 = await server.inject({
          method: 'POST',
          url: '/reset-password',
          payload: {
            token,
            password: 'new-password'
          }
        });
        expect(response4.statusCode).equals(200);

        // try to use tokens created after password resetting
        const response5 = await server.inject({
          method: 'GET',
          url: '/protected',
          ...helpers.withAuthorization(tokens1),
        });
        const response6 = await server.inject({
          method: 'GET',
          url: '/protected',
          ...helpers.withAuthorization(tokens2),
        });
        expect(response5.statusCode).equals(401);
        expect(response6.statusCode).equals(401);
      });
    });
  });

  describe('GET /check-token', () => {
    it('Check valid token: result=true', async () => {
      const {
        userService
      } = server.services();
      const user = await userService.signup({
        name: 'name',
        email: 'email@email.ru',
        password: 'password',
      });
      const tokens = await userService.createTokens(user);
      const token = jwt.sign({
        data: 'somedata',
        userId: user.id,
      }, user.password_hash, {
        expiresIn: 60 // seconds
      });
      const response = await server.inject({
        method: 'GET',
        url: `/check-token?token=${token}`,
        ...helpers.withAuthorization(tokens),
      });
      expect(response.statusCode).equals(200);
      const payload = JSON.parse(response.payload);
      expect(payload.result).true();
    });
    it('Check invalid token: result=false', async () => {
      const {
        userService
      } = server.services();
      const user = await userService.signup({
        name: 'name',
        email: 'email@email.ru',
        password: 'password',
      });
      const tokens = await userService.createTokens(user);
      const token = jwt.sign({
        data: 'somedata',
        userId: user.id,
      }, user.password_hash, {
        expiresIn: 60 // seconds
      });
      MockDate.set(Date.now() + 60 * 1000 + 1);
      const response = await server.inject({
        method: 'GET',
        url: `/check-token?token=${token}`,
        ...helpers.withAuthorization(tokens),
      });
      MockDate.reset();
      expect(response.statusCode).equals(200);
      const payload = JSON.parse(response.payload);
      expect(payload.result).false();
    });
  });

  describe('GET /detach-account/{socialNetworkService}', () => {
    describe('Check that can\'t detach last login method', () => {
      it('return Bad Request', async () => {
        const {
          userService,
          userDatabaseService: udb,
        } = server.services();
        const user = await userService.signup({
          name: 'name',
          email: 'email@email.email',
        });
        await udb.updateUser(user.id, {
          auth: {
            facebook: {
              id: 'some-facebook-id'
            }
          }
        });
        const tokens = await userService.createTokens(user);
        const response = await server.inject({
          method: 'GET',
          url: '/detach-account/facebook',
          ...helpers.withAuthorization(tokens),
        });
        expect(response.statusCode).equals(400);
        const payload = JSON.parse(response.payload);
        expect(payload.message).equals(errorMessages.lastLoginMethod);
      });
    });
    describe('Check that extenral account detached', () => {
      it('there is no info for that external account', async () => {
        const {
          userService,
          userDatabaseService: udb,
        } = server.services();
        const user = await userService.signup({
          name: 'name',
          email: 'email@email.email',
          password: 'password',
        });
        await udb.updateUser(user.id, {
          auth: {
            facebook: {
              id: 'some-facebook-id',
            }
          }
        });
        const tokens = await userService.createTokens(user);
        const response = await server.inject({
          method: 'GET',
          url: '/detach-account/facebook',
          ...helpers.withAuthorization(tokens),
        });
        expect(response.statusCode).equals(200);

        const updatedUser = await udb.findById(user.id);
        expect(updatedUser.auth.facebook).not.exists();
      });
    });
  });

  describe('GET /user/${userId}/', () => {
    describe('request info about user from another workspace', () => {
      it('should return 403 forbidden error', async () => {
        const { userService } = server.services();
        const user1 = await userService.signup({ email: 'user1@watching.you' });
        const user2 = await userService.signup({ email: 'user2@watching.you' });
        const tokens = await userService.createTokens({ id: user1.id });
        const response = await server.inject({
          method: 'GET',
          url: `/user/${user2.id}`,
          headers: {
            'Authorization': `Bearer ${tokens.accessToken}`
          }
        });
        expect(response.statusCode).to.be.equal(403);
      });
    });
    describe('request info about user from your workspace', () => {
      it('should return info with 200 status', async () => {
        const { userService, workspaceService, } = server.services();
        const user1 = await userService.signup({ email: 'user1@watching.you' });
        const user2 = await userService.signup({
          email: 'user2@watching.you',
          name: 'Test User'
        });
        const tokens = await userService.createTokens({ id: user1.id });
        const { workspace: w1 } = await workspaceService.createWorkspace(user1, 'workspace1');
        await workspaceService.addUserToWorkspace(w1.id, user2.id);
        const response = await server.inject({
          method: 'GET',
          url: `/user/${user2.id}`,
          headers: {
            'Authorization': `Bearer ${tokens.accessToken}`
          }
        });
        expect(response.statusCode).to.be.equal(200);
        expect(response.result.id).equals(user2.id);
        expect(response.result.email).equals(user2.email);
      });
    });
  });

  describe('POST /password', () => {
    it('should return 401 if old password is invalid', async () => {
      const {
        userService
      } = server.services();
      const user = await userService.signup({
        name: 'name',
        email: 'email@email.ru',
        password: 'password',
      });
      const tokens = await userService.createTokens(user);
      const response = await server.inject({
        method: 'POST',
        url: `/password`,
        payload: {
          oldPassword: 'invalid-password',
          password: 'new-password',
        },
        ...helpers.withAuthorization(tokens),
      });
      expect(response.statusCode).equals(401);
    });
    it('should set new password if there was not previous password', async () => {
      const {
        userService,
        userDatabaseService: udb,
      } = server.services();
      const user = await userService.signup({
        name: 'name',
        email: 'email@email.ru',
      });
      const tokens = await userService.createTokens(user);
      const response = await server.inject({
        method: 'POST',
        url: `/password`,
        payload: {
          password: 'new-password',
        },
        ...helpers.withAuthorization(tokens),
      });
      expect(response.statusCode).equals(200);
      const newUser = await udb.findById(user.id);
      expect(newUser.password_hash).exists();
    });
    it('should set new password', async () => {
      const {
        userService,
        userDatabaseService: udb,
      } = server.services();
      const user = await userService.signup({
        name: 'name',
        email: 'email@email.ru',
        password: 'qwerty'
      });
      const tokens = await userService.createTokens(user);
      const response = await server.inject({
        method: 'POST',
        url: `/password`,
        payload: {
          oldPassword: 'qwerty',
          password: 'new-password',
        },
        ...helpers.withAuthorization(tokens),
      });
      expect(response.statusCode).equals(200);
      const newUser = await udb.findById(user.id);
      expect(newUser.password_hash).exists();
      expect(newUser.password_hash).not.equals(user.password_hash);
    });
    it('should cancel all sessions after password changed', async () => {
      const {
        userService,
      } = server.services();
      const user = await userService.signup({
        name: 'name',
        email: 'email@email.ru',
        password: 'qwerty'
      });
      const tokens = await userService.createTokens(user);
      const tokens2 = await userService.createTokens(user);
      await userService.createTokens(user);
      const response = await server.inject({
        method: 'POST',
        url: `/password`,
        payload: {
          oldPassword: 'qwerty',
          password: 'new-password',
        },
        ...helpers.withAuthorization(tokens),
      });
      expect(response.statusCode).equals(200);
      const session1 = await userService.findAccessToken(tokens.accessToken);
      const session2 = await userService.findAccessToken(tokens2.accessTOken);
      expect(session1).not.exists();
      expect(session2).not.exists();
    });
  });
  /**
   * Workspaces
   */
  describe('POST /workspaces', () => {
    describe('With valid input data', () => {
      it('should return workspace object', async () => {
        const { userService } = server.services();
        const user = await userService.signup({ email: 'big_brother_is@watching.you' });
        const tokens = await userService.createTokens({ id: user.id });
        const response = await server.inject({
          method: 'POST',
          url: '/workspaces',
          headers: {
            'Authorization': `Bearer ${tokens.accessToken}`
          },
          payload: {
            name: 'TestWorkspace'
          }
        });
        expect(response.statusCode).to.be.equal(200);
        const payload = JSON.parse(response.payload);
        expect(payload).includes('workspace');
      });
      it('should create default channels for that workspace and grant tokens for it', async () => {
        const { userService, workspaceService } = server.services();
        const user = await userService.signup({ email: 'big_brother_is@watching.you' });
        const tokens = await userService.createTokens({ id: user.id });
        const response = await server.inject({
          method: 'POST',
          url: '/workspaces',
          headers: {
            'Authorization': `Bearer ${tokens.accessToken}`
          },
          payload: {
            name: 'TestWorkspace 222'
          }
        });
        expect(response.statusCode).to.be.equal(200);
        const payload = JSON.parse(response.payload);
        const workspaceState = await workspaceService.getWorkspaceStateForUser(payload.workspace.id, user.id);
        expect(workspaceState.channels.length).equals(1);
      });
      it('should create workspace with avatarFileId', async () => {
        const {
          userService,
          fileDatabaseService: fdb,
        } = server.services();
        const user = await userService.signup({ email: 'big_brother_is@watching.you' });
        const fileDbInfo = {
          id: uuid4(),
          user_id: user.id,
          created_at: new Date(),
          type: 'avatar',
          updated_at: new Date(),
          filename: uuid4() + '.png',
        };
        await fdb.insertFile(fileDbInfo);
        const tokens = await userService.createTokens({ id: user.id });
        const response = await server.inject({
          method: 'POST',
          url: '/workspaces',
          headers: {
            'Authorization': `Bearer ${tokens.accessToken}`
          },
          payload: {
            name: 'TestWorkspace',
            avatarFileId: fileDbInfo.id,
          }
        });
        expect(response.statusCode).to.be.equal(200);
        expect(response.result).includes('workspace');
        expect(response.result.workspace).includes('avatarSet');
      });
    });
  });

  describe('POST /workspaces/{workspaceId}', () => {
    describe('Try to update workspace by an usual user', () => {
      it('should return 403 error', async () => {
        const {
          userService,
          workspaceService,
        } = server.services();
        const admin = await userService.signup({ name: 'admin' });
        const user = await userService.signup({ name: 'user' });
        const tokensUser = await userService.createTokens(user);
        const { workspace } = await workspaceService.createNewWorkspace(admin.id, {
          name: 'test'
        });
        await workspaceService.addUserToWorkspace(workspace.id, user.id, 'user');
        const responseUpdate = await server.inject({
          method: 'POST',
          url: `/workspaces/${workspace.id}`,
          ...helpers.withAuthorization(tokensUser),
          payload: {
            name: 'UpdateName'
          },
        });
        expect(responseUpdate.statusCode).equals(403);
      });
    });
    describe('Try to update workspace by moderator', () => {
      it('should update workspace', async () => {
        const {
          userService,
          workspaceService,
        } = server.services();
        const admin = await userService.signup({ name: 'admin' });
        const user = await userService.signup({ name: 'user' });
        const tokensUser = await userService.createTokens(user);
        const { workspace } = await workspaceService.createNewWorkspace(admin.id, {
          name: 'test'
        });
        await workspaceService.addUserToWorkspace(workspace.id, user.id, 'moderator');
        const responseUpdate = await server.inject({
          method: 'POST',
          url: `/workspaces/${workspace.id}`,
          ...helpers.withAuthorization(tokensUser),
          payload: {
            name: 'UpdateName'
          },
        });
        expect(responseUpdate.statusCode).equals(200);
        expect(responseUpdate.result.workspace.name).equals('UpdateName');
      });
      it('should update workspace with avatarFileId', async () => {
        const {
          userService,
          workspaceService,
          fileDatabaseService: fdb,
        } = server.services();
        const admin = await userService.signup({ name: 'admin' });
        const tokens = await userService.createTokens(admin);
        const { workspace } = await workspaceService.createNewWorkspace(admin.id, {
          name: 'test'
        });
        const fileDbInfo = {
          id: uuid4(),
          user_id: admin.id,
          created_at: new Date(),
          type: 'avatar',
          updated_at: new Date(),
          filename: uuid4() + '.png',
        };
        await fdb.insertFile(fileDbInfo);

        const responseUpdate = await server.inject({
          method: 'POST',
          url: `/workspaces/${workspace.id}`,
          ...helpers.withAuthorization(tokens),
          payload: {
            name: 'UpdateName',
            avatarFileId: fileDbInfo.id
          },
        });
        expect(responseUpdate.statusCode).equals(200);
        expect(responseUpdate.result.workspace.name).equals('UpdateName');
        expect(responseUpdate.result.workspace.avatarSet.image64x64).exists();
      });
      it('should update workspace with avatarFileId equals null', async () => {
        const {
          userService,
          workspaceService,
          workspaceDatabaseService: wdb,
          fileDatabaseService: fdb,
        } = server.services();
        const admin = await userService.signup({ name: 'admin' });
        const tokens = await userService.createTokens(admin);
        const { workspace } = await workspaceService.createNewWorkspace(admin.id, {
          name: 'test'
        });
        const fileDbInfo = {
          id: uuid4(),
          user_id: admin.id,
          created_at: new Date(),
          type: 'avatar',
          updated_at: new Date(),
          filename: uuid4() + '.png',
        };
        await fdb.insertFile(fileDbInfo);
        await wdb.updateWorkspace(workspace.id, {
          avatar_file_id: fileDbInfo.id,
          avatar_set: {
            avatar12x12: 'http://example.com/image.png',
          },
        });

        const responseUpdate = await server.inject({
          method: 'POST',
          url: `/workspaces/${workspace.id}`,
          ...helpers.withAuthorization(tokens),
          payload: {
            avatarFileId: null
          },
        });
        expect(responseUpdate.statusCode).equals(200);
        expect(responseUpdate.result.workspace.avatarFileId).not.exists();
      });
    });
  });

  describe('DELETE /workspaces/{workspaceId}', () => {
    it('Delete workspace with wrong name', async () => {
      const {
        userService,
        workspaceService,
      } = server.services();
      const admin = await userService.signup({ name: 'admin' });
      const user = await userService.signup({ name: 'user' });
      const tokens = await userService.createTokens(admin);
      const { workspace } = await workspaceService.createNewWorkspace(admin.id, {
        name: 'test'
      });
      await workspaceService.addUserToWorkspace(workspace.id, user.id, 'moderator');
      const responseUpdate = await server.inject({
        method: 'DELETE',
        url: `/workspaces/${workspace.id}`,
        ...helpers.withAuthorization(tokens),
        payload: {
          name: 'test2'
        },
      });
      expect(responseUpdate.statusCode).equals(400);
    });
    it('Delete workspace with proper name', async () => {
      const {
        userService,
        workspaceService,
      } = server.services();
      const admin = await userService.signup({ name: 'admin' });
      const user = await userService.signup({ name: 'user' });
      const tokens = await userService.createTokens(admin);
      const { workspace } = await workspaceService.createNewWorkspace(admin.id, {
        name: 'test'
      });
      await workspaceService.addUserToWorkspace(workspace.id, user.id, 'moderator');
      const responseUpdate = await server.inject({
        method: 'DELETE',
        url: `/workspaces/${workspace.id}`,
        ...helpers.withAuthorization(tokens),
        payload: {
          name: 'test'
        },
      });
      expect(responseUpdate.statusCode).equals(200);
    });
  });

  describe('POST /workspaces/{workspaceId}/settings', () => {
    it('Update workspace settings, should update', async () => {
      const {
        userService,
        workspaceService,
      } = server.services();
      const admin = await userService.signup({ name: 'admin' });
      const tokensUser = await userService.createTokens(admin);
      const { workspace } = await workspaceService.createNewWorkspace(admin.id, {
        name: 'test'
      });
      const responseUpdate = await server.inject({
        method: 'POST',
        url: `/workspaces/${workspace.id}/settings`,
        ...helpers.withAuthorization(tokensUser),
        payload: {
          canUsersInvite: false,
        },
      });
      expect(responseUpdate.statusCode).equals(200);
      expect(responseUpdate.result.workspace.canUsersInvite).equals(false);
    });
  });

  describe('POST /workspaces/{workspaceId}/channels', () => {
    describe('user cant create channel (not an admin, moderator or user)', () => {
      it('should return 401 error', async () => {
        const {
          userService,
          workspaceService
        } = server.services();
        // create users
        const admin = await userService.signup({ email: 'admin@user.net' });
        const guest = await userService.signup({ email: 'guest@user.net' });
        // create tokens
        const tokens = await userService.createTokens(guest);
        // create workspace
        const { workspace } = await workspaceService.createWorkspace(admin, 'testWorkspace');
        // add guest to the workspace as a guest
        await workspaceService.addUserToWorkspace(workspace.id, guest.id, 'guest');
        const response = await server.inject({
          method: 'POST',
          url: `/workspaces/${workspace.id}/channels`,
          payload: {
            isPrivate: false,
            name: 'testChannel'
          },
          headers: {
            'Authorization': `Bearer ${tokens.access}`
          }
        });
        expect(response.statusCode).to.be.equal(401);
      });
    });
    describe('user can create channel (an admin, moderator or user)', () => {
      it('should create channel and return it', async () => {
        const {
          userService,
          workspaceService
        } = server.services();
        // create users
        const admin = await userService.signup({ email: 'admin@user.net' });
        // create tokens
        const tokens = await userService.createTokens(admin);
        // create workspace
        const { workspace } = await workspaceService.createWorkspace(admin, 'testWorkspace');
        const response = await server.inject({
          method: 'POST',
          url: `/workspaces/${workspace.id}/channels`,
          payload: {
            isPrivate: false,
            name: 'testChannel'
          },
          headers: {
            'Authorization': `Bearer ${tokens.accessToken}`
          }
        });
        expect(response.statusCode).to.be.equal(200);
        const result = JSON.parse(response.payload);
        expect(result.channel.id).exists();
        expect(result.channel.name).exists();
      });
      it('check "creatorId" field exists', async () => {
        const {
          userService,
          workspaceService
        } = server.services();
        // create users
        const admin = await userService.signup({ email: 'admin@user.net' });
        // create tokens
        const tokens = await userService.createTokens(admin);
        // create workspace
        const { workspace } = await workspaceService.createWorkspace(admin, 'testWorkspace');
        const response = await server.inject({
          method: 'POST',
          url: `/workspaces/${workspace.id}/channels`,
          payload: {
            isPrivate: false,
            name: 'testChannel'
          },
          headers: {
            'Authorization': `Bearer ${tokens.accessToken}`
          }
        });
        expect(response.statusCode).to.be.equal(200);
        const result = JSON.parse(response.payload);
        expect(result.channel.creatorId).exists();
        expect(result.channel.creatorId).equals(admin.id);
      });
    });
  });

  describe('GET /workspaces', () => {
    describe('request a list of user\'s workspaces', () => {
      it('should return an array with workspaces that are belong to the authed user', async () => {
        const { userService, workspaceService } = server.services();
        const user = await userService.signup({ email: 'big_brother_is@watching.you' });
        const tokens = await userService.createTokens({ id: user.id });
        const anotherUser = await userService.signup({ email: 'another@user.ru' });
        const { workspace: w1 } = await workspaceService.createWorkspace(user, 'workspace1');
        const { workspace: w2 } = await workspaceService.createWorkspace(user, 'workspace2');
        const { workspace: w3 } = await workspaceService.createWorkspace(anotherUser, 'workspace3');
        const response = await server.inject({
          method: 'GET',
          url: '/workspaces',
          headers: {
            'Authorization': `Bearer ${tokens.accessToken}`
          }
        });
        expect(response.statusCode).to.be.equal(200);
        const payload = JSON.parse(response.payload);
        expect(payload).array().length(2);
        expect(payload.find(i => i.id === w1.id)).exist();
        expect(payload.find(i => i.id === w2.id)).exist();
        expect(payload.find(i => i.id === w3.id)).not.exist();
      });
    });
  });

  describe('GET /workspaces/{workspaceId}/info', () => {
    describe('request info about workspace', () => {
      it('should return workspace info with 200 status', async () => {
        const { userService, workspaceService } = server.services();
        const user = await userService.signup({ email: 'user@heyka.com', name: 'n' });
        // создаём третьего юзера, который не должен фигурировать нигде
        const tokens = await userService.createTokens({ id: user.id });
        const { workspace } = await workspaceService.createWorkspace(user, 'workspace1');
        const response = await server.inject({
          method: 'GET',
          url: `/workspaces/${workspace.id}/info`,
          headers: {
            'Authorization': `Bearer ${tokens.accessToken}`
          }
        });
        expect(response.statusCode).to.be.equal(200);
        expect(response.result.name).equals(workspace.name);
      });
    });
  });

  describe('GET /workspaces/{workspaceId}', () => {
    describe('request the state of the workspace', () => {
      it('should return workspace state, array of users and channels', async () => {
        const {
          userService,
          workspaceService,
          userDatabaseService,
        } = server.services();
        const user = await userService.signup({ email: 'user@heyka.com', name: 'n' });
        const user2 = await userService.signup({ email: 'user2@heyka.com', name: 'n2' });
        await userDatabaseService.updateUser(user.id, { auth: { slack: { id: 'ok'} } });
        // создаём третьего юзера, который не должен фигурировать нигде
        const user3 = await userService.signup({ email: 'user3@heyka.com', name: 'n3' });
        const tokens = await userService.createTokens({ id: user.id });
        const { workspace } = await workspaceService.createWorkspace(user, 'workspace1');
        await workspaceService.addUserToWorkspace(workspace.id, user2.id, 'user');
        await workspaceService.createChannel(workspace.id, user.id, { name: 'test', isPrivate: false });
        const response = await server.inject({
          method: 'GET',
          url: `/workspaces/${workspace.id}`,
          headers: {
            'Authorization': `Bearer ${tokens.accessToken}`
          }
        });
        expect(response.statusCode).to.be.equal(200);
        const payload = JSON.parse(response.payload);
        expect(payload.workspace).exists();
        expect(payload.channels).exists();
        expect(payload.users).exists();
        expect(payload.users.find(u => u.id === user3.id)).not.exists();
        expect(payload.users.length).equals(2);
        expect(payload.channels.length).equals(2);
      });
      it('should return media state of users that are selected channels', async () => {
        const { userService, workspaceService, connectionService } = server.services();
        const user = await userService.signup({ email: 'user@heyka.com', name: 'n' });
        const user2 = await userService.signup({ email: 'user2@heyka.com', name: 'n' });
        const tokens = await userService.createTokens({ id: user.id });
        const tokens2 = await userService.createTokens(user2);
        const { workspace } = await workspaceService.createWorkspace(user, 'workspace1');
        await workspaceService.addUserToWorkspace(workspace.id, user2.id, 'user');
        const channel = await workspaceService.createChannel(workspace.id, user.id, { name: 'test', isPrivate: false });

        // add fake connections for users
        const conn1 = generateFakeConnection(user.id, workspace.id);
        await connectionService.setConnectionObject(conn1);
        const conn2 = generateFakeConnection(user2.id, workspace.id);
        await connectionService.setConnectionObject(conn2);

        // user2 select the channel
        const responseForSelecting = await server.inject({
          method: 'POST',
          url: `/channels/${channel.id}/select?socketId=${conn2.connectionId}`,
          ...helpers.withAuthorization(tokens2),
          payload: helpers.defaultUserState()
        });
        expect(responseForSelecting.statusCode).equals(200);
        const response = await server.inject({
          method: 'GET',
          url: `/workspaces/${workspace.id}`,
          headers: {
            'Authorization': `Bearer ${tokens.accessToken}`
          }
        });
        expect(response.statusCode).to.be.equal(200);
        const payload = JSON.parse(response.payload);
        expect(payload.workspace).exists();
        expect(payload.channels).exists();
        expect(payload.users).exists();
        expect(payload.users.length).equals(2);
        expect(payload.channels.length).equals(2);
        const channelWithUser = payload.channels.find(ch => ch.id === channel.id);
        expect(channelWithUser.users.length).equals(1);
        expect(channelWithUser.users[0].userId).equals(user2.id);
      });
    });
  });

  describe('POST /workspaces/{workspaceId}/leave', () => {
    describe('The last admin in the workspace tries to leave', () => {
      it('should response with error (the last admin cant leave workspace', async () => {
        const {
          userService,
          workspaceService
        } = server.services();
        const user = await userService.signup({ email: 'user@heyka.ru'});
        const { workspace } = await workspaceService.createWorkspace(user, 'test');
        const tokens = await userService.createTokens(user);
        const response = await server.inject({
          method: 'POST',
          url: `/workspaces/${workspace.id}/leave`,
          ...helpers.withAuthorization(tokens)
        });
        expect(response.statusCode).equals(403);
      });
    });
    describe('User tries to leave the workspace and he can do it', () => {
      it('should kick the user from the all workspace channels and from the workspace', async () => {
        const {
          userService,
          workspaceService,
          workspaceDatabaseService: wdb
        } = server.services();
        const admin = await userService.signup({ email: 'admin@heyka.ru'});
        const user = await userService.signup({ email: 'user@heyka.ru' });
        const { workspace } = await workspaceService.createWorkspace(admin, 'test');
        await workspaceService.addUserToWorkspace(workspace.id, user.id);
        const tokens = await userService.createTokens(user);
        const response = await server.inject({
          method: 'POST',
          url: `/workspaces/${workspace.id}/leave`,
          ...helpers.withAuthorization(tokens)
        });
        expect(response.statusCode).equals(200);
        // there shouldnt be any relations between user and workspace channels
        const channelsForUser = await wdb.getWorkspaceChannelsForUser(workspace.id, user.id);
        expect(channelsForUser).length(0);
        // there shouldnt be any relation between user and worskpaces
        const userWorkspaces = await wdb.getWorkspacesByUserId(user.id);
        expect(userWorkspaces).length(0);
      });
    });
  });

  describe('POST /workspaces/{workspaceId}/private-talk', () => {
    describe('Create private talk for several users', () => {
      it('channel name contains first names of all users', async () => {
        const {
          userService,
          workspaceService,
          workspaceDatabaseService: wdb
        } = server.services();
        // create users
        const user1 = await userService.signup({ email: 'user1@user.net', name: 'Admin Kurat' });
        const user2 = await userService.signup({ email: 'user2@user.net', name: 'Tester Popov' });

        // create tokens
        const tokens = await userService.createTokens(user2);

        // create workspace
        const { workspace } = await workspaceService.createWorkspace(user1, 'testWorkspace');
        await workspaceService.addUserToWorkspace(workspace.id, user2.id, 'user');

        const response = await server.inject({
          method: 'POST',
          url: `/workspaces/${workspace.id}/private-talk`,
          payload: {
            users: [user1.id],
          },
          headers: {
            'Authorization': `Bearer ${tokens.accessToken}`
          }
        });
        expect(response.statusCode).to.be.equal(200);

        const channels = await wdb.getWorkspaceChannelsForUser(workspace.id, user2.id);

        const ch = channels.find(el => el.is_tmp);
        expect(ch.name).equals('Tester, Admin');
      });
      it ('returns already existed channel if it exists', async () => {
        const {
          userService,
          workspaceService,
        } = server.services();
        // create users
        const user1 = await userService.signup({ email: 'user1@user.net', name: 'Admin Kurat' });
        const user2 = await userService.signup({ email: 'user2@user.net', name: 'Tester Popov' });

        // create tokens
        const tokens1 = await userService.createTokens(user1);
        const tokens2 = await userService.createTokens(user2);

        // create workspace
        const { workspace } = await workspaceService.createWorkspace(user1, 'testWorkspace');
        await workspaceService.addUserToWorkspace(workspace.id, user2.id, 'user');

        // first private talk
        const response1 = await server.inject({
          method: 'POST',
          url: `/workspaces/${workspace.id}/private-talk`,
          payload: {
            users: [user2.id],
          },
          headers: {
            'Authorization': `Bearer ${tokens1.accessToken}`
          }
        });
        expect(response1.statusCode).to.be.equal(200);
        const payload1 = JSON.parse(response1.payload);

        // second private talk request
        const response2 = await server.inject({
          method: 'POST',
          url: `/workspaces/${workspace.id}/private-talk`,
          payload: {
            users: [user1.id],
          },
          headers: {
            'Authorization': `Bearer ${tokens2.accessToken}`
          }
        });
        expect(response2.statusCode).to.be.equal(200);
        const payload2 = JSON.parse(response2.payload);

        expect(payload1.channel.id).equals(payload2.channel.id);
      });
    });
    describe('Check push notifications', () => {
      it('create private talk to user with device tokens', async () => {
        const {
          userService,
          workspaceService,
          userDatabaseService: udb,
          workspaceDatabaseService: wdb,
        } = server.services();
        // create users
        const user1 = await userService.signup({ email: 'user1@user.net', name: 'Admin Kurat' });
        const user2 = await userService.signup({ email: 'user2@user.net', name: 'Tester Popov' });

        // added device token for user
        const deviceToken = uuid4();
        await udb.updateUser(user1.id, {
          device_tokens: [deviceToken],
        });

        // create tokens
        const tokens = await userService.createTokens(user2);

        // create workspace
        const { workspace } = await workspaceService.createWorkspace(user1, 'testWorkspace');
        await workspaceService.addUserToWorkspace(workspace.id, user2.id, 'user');

        const response = await server.inject({
          method: 'POST',
          url: `/workspaces/${workspace.id}/private-talk`,
          payload: {
            users: [user1.id],
          },
          headers: {
            'Authorization': `Bearer ${tokens.accessToken}`
          }
        });
        expect(response.statusCode).to.be.equal(200);

        // check that push notification has been sent
        expect(stubbedMethods.sendPushNotificationToDevice.calledOnce).true();
        expect(stubbedMethods.sendPushNotificationToDevice.firstCall.args[0]).equals(deviceToken);

        // delete channel and check that push notification has been sent
        const channels = await wdb.getWorkspaceChannelsForUser(workspace.id, user2.id);
        const ch = channels.find(el => el.is_tmp);
        await workspaceService.deleteChannel(ch.id);
        console.log(stubbedMethods.sendPushNotificationToDevice.callCount);
        expect(stubbedMethods.sendPushNotificationToDevice.calledTwice).true();
        expect(stubbedMethods.sendPushNotificationToDevice.secondCall.args[1].event).equals('invite-cancelled');
      });
    });
  });

  describe('GET /workspaces/{workspaceId}/invites', () => {
    describe('List all workspace invites by user', () => {
      it('should return 403', async () => {
        const {
          userService,
          workspaceService,
        } = server.services();
        const user = await userService.signup({ name: 'test' });
        const admin = await userService.signup({ name: 'admin' });
        const { workspace } = await workspaceService.createWorkspace(admin, 'test');
        const userTokens = await userService.createTokens(user);
        await workspaceService.addUserToWorkspace(workspace.id, user.id);
        const response = await server.inject({
          method: 'GET',
          url: `/workspaces/${workspace.id}/invites?list=all`,
          ...helpers.withAuthorization(userTokens)
        });
        expect(response.statusCode).equals(403);
      });
    });
    describe('List all workspace invites by admin', () => {
      it('should return list of invites', async () => {
        const {
          userService,
          workspaceService,
        } = server.services();
        const admin = await userService.signup({ name: 'admin' });
        const { workspace } = await workspaceService.createWorkspace(admin, 'test');
        const adminTokens = await userService.createTokens(admin);
        const codes = await Promise.all([
          workspaceService.inviteToWorkspace(workspace.id, admin.id),
          workspaceService.inviteToWorkspace(workspace.id, admin.id),
          workspaceService.inviteToWorkspace(workspace.id, admin.id),
        ]);
        const response = await server.inject({
          method: 'GET',
          url: `/workspaces/${workspace.id}/invites?list=all`,
          ...helpers.withAuthorization(adminTokens)
        });
        expect(response.statusCode).equals(200);
        expect(response.result.find(i => i.code === codes[0])).exists();
        expect(response.result.find(i => i.code === codes[1])).exists();
        expect(response.result.find(i => i.code === codes[2])).exists();
      });
    });
  });

  describe('POST /workspaces/{workspaceId}/permissions', () => {
    it('Change member role from user to admin', async () => {
      const {
        userService,
        workspaceService,
        workspaceDatabaseService: wdb
      } = server.services();
      const admin = await userService.signup({ email: 'admin@heyka.ru'});
      const user = await userService.signup({ email: 'user@heyka.ru' });
      const { workspace } = await workspaceService.createWorkspace(admin, 'test');
      await workspaceService.addUserToWorkspace(workspace.id, user.id);
      const tokens = await userService.createTokens(admin);
      const response = await server.inject({
        method: 'POST',
        url: `/workspaces/${workspace.id}/permissions`,
        payload: {
          userId: user.id,
          role: 'admin',
        },
        ...helpers.withAuthorization(tokens)
      });
      expect(response.statusCode).equals(200);
      // there shouldnt be any relations between user and workspace channels
      const [ relation ] = await wdb.getUserWorkspaceRelations(workspace.id, user.id);
      expect(relation.role).equals('admin');
    });
    it('Add user to workspace through that method', async () => {
      const {
        userService,
        workspaceService,
        workspaceDatabaseService: wdb
      } = server.services();
      const admin = await userService.signup({ email: 'admin@heyka.ru'});
      const user = await userService.signup({ email: 'user@heyka.ru' });
      const { workspace } = await workspaceService.createWorkspace(admin, 'test');
      const tokens = await userService.createTokens(admin);
      const response = await server.inject({
        method: 'POST',
        url: `/workspaces/${workspace.id}/permissions`,
        payload: {
          userId: user.id,
          role: 'user',
        },
        ...helpers.withAuthorization(tokens)
      });
      expect(response.statusCode).equals(200);
      // there shouldnt be any relations between user and workspace channels
      const [ relation ] = await wdb.getUserWorkspaceRelations(workspace.id, user.id);
      expect(relation.role).equals('user');
    });
  });

  describe('DELETE /workspaces/{workspaceId}/members/{userId}', () => {
    it('Delete user from workspace', async () => {
      const {
        userService,
        workspaceService,
        workspaceDatabaseService: wdb
      } = server.services();
      const admin = await userService.signup({ email: 'admin@heyka.ru'});
      const user = await userService.signup({ email: 'user@heyka.ru' });
      const { workspace } = await workspaceService.createWorkspace(admin, 'test');
      await workspaceService.addUserToWorkspace(workspace.id, user.id);
      const tokens = await userService.createTokens(admin);
      const response = await server.inject({
        method: 'DELETE',
        url: `/workspaces/${workspace.id}/members/${user.id}`,
        ...helpers.withAuthorization(tokens)
      });
      expect(response.statusCode).equals(200);
      // there shouldnt be any relations between user and workspace channels
      const relations = await wdb.getUserWorkspaceRelations(workspace.id, user.id);
      expect(relations).length(0);
    });
    it('Cant delete workspace creator', async () => {
      const {
        userService,
        workspaceService,
      } = server.services();
      const admin = await userService.signup({ email: 'admin@heyka.ru'});
      const user = await userService.signup({ email: 'user@heyka.ru' });
      const { workspace } = await workspaceService.createWorkspace(admin, 'test');
      await workspaceService.addUserToWorkspace(workspace.id, user.id, 'admin');
      const tokens = await userService.createTokens(user);
      const response = await server.inject({
        method: 'DELETE',
        url: `/workspaces/${workspace.id}/members/${admin.id}`,
        ...helpers.withAuthorization(tokens)
      });
      expect(response.statusCode).equals(403);
    });
  });

  /**
   * Channels
   */
  describe('POST /channels/{channelId}/select', () => {
    describe('Try to select channel which user hasnt access', () => {
      it('should return forbidden error', async () => {
        const {
          userService,
          workspaceService
        } = server.services();
        const user = await userService.signup({ email: 'test@user.ru' });
        const user2 = await userService.signup({ email: 'test2@user.ru' });
        const { workspace } = await workspaceService.createWorkspace(user, 'test');
        const channel = await workspaceService.createChannel(workspace.id, user.id, {
          name: 'test',
          isPrivate: false
        });
        const tokens = await userService.createTokens(user2);
        const response = await server.inject({
          method: 'POST',
          url: `/channels/${channel.id}/select?socketId=${uuid4()}`,
          ...helpers.withAuthorization(tokens),
          payload: helpers.defaultUserState()
        });
        expect(response.statusCode).equals(403);
      });
    });
    describe('Select channel when user wasnt in any channels', () => {
      it('should return 200 and user should appear in channel users list', async () => {
        const {
          userService,
          workspaceService,
          connectionService
        } = server.services();
        const user = await userService.signup({ email: 'test@user.ru' });
        const { workspace } = await workspaceService.createWorkspace(user, 'test');
        const channel = await workspaceService.createChannel(workspace.id, user.id, {
          name: 'test',
          isPrivate: false
        });
        const tokens = await userService.createTokens(user);
        const conn = generateFakeConnection(user.id, workspace.id);
        await connectionService.setConnectionObject(conn);
        const response = await server.inject({
          method: 'POST',
          url: `/channels/${channel.id}/select?socketId=${conn.connectionId}`,
          ...helpers.withAuthorization(tokens),
          payload: helpers.defaultUserState()
        });
        expect(response.statusCode).equals(200);
        const connections = await connectionService.getChannelConnections(channel.id);
        expect(connections.map(c => c.userId)).includes(user.id);
      });
      it('should return 200 and add auth tokens of workspace and channel for user', async () => {
        const {
          userService,
          workspaceService,
          connectionService
        } = server.services();
        const user = await userService.signup({ email: 'test@user.ru' });
        const { workspace } = await workspaceService.createWorkspace(user, 'test');
        const channel = await workspaceService.createChannel(workspace.id, user.id, {
          name: 'test',
          isPrivate: false
        });
        const tokens = await userService.createTokens(user);
        const conn = generateFakeConnection(user.id, workspace.id);
        await connectionService.setConnectionObject(conn);
        const response = await server.inject({
          method: 'POST',
          url: `/channels/${channel.id}/select?socketId=${conn.connectionId}`,
          ...helpers.withAuthorization(tokens),
          payload: helpers.defaultUserState()
        });
        expect(response.statusCode).equals(200);
        const connections = await connectionService.getChannelConnections(channel.id);
        expect(connections.map(c => c.userId)).includes(user.id);

        // auth token should be added
        expect(stubbedMethods.addAuthTokenForWorkspace.calledOnce).true();
        // rooms should be created
        expect(stubbedMethods.createAudioVideoRooms.calledOnce).true();
        // tokens for channels should be added
        expect(stubbedMethods.manageAuthTokensForChannel.calledOnce).true();

        // check auth tokens
        const connection = await connectionService.getConnection(conn.connectionId);
        expect(stubbedMethods.addAuthTokenForWorkspace.firstCall.args[0][0]).equals(connection.janusServerAuthToken);
        expect(stubbedMethods.manageAuthTokensForChannel.firstCall.args[0][1][0])
          .equals(connection.janusChannelAuthToken);
      });
    });
    describe('Select channel when user was in another channel', () => {
      it('user should appear in new users list and disappear in the old users list', async () => {
        const {
          userService,
          workspaceService,
          connectionService
        } = server.services();
        const user = await userService.signup({ email: 'test@user.ru' });
        const { workspace } = await workspaceService.createWorkspace(user, 'test');
        const channel1 = await workspaceService.createChannel(workspace.id, user.id, {
          name: 'test',
          isPrivate: false
        });
        const channel2 = await workspaceService.createChannel(workspace.id, user.id, {
          name: 'test2',
          isPrivate: false
        });
        const conn = generateFakeConnection(user.id, workspace.id);
        await connectionService.setConnectionObject(conn);
        const tokens = await userService.createTokens(user);
        // select first channel
        await server.inject({
          method: 'POST',
          url: `/channels/${channel1.id}/select?socketId=${conn.connectionId}`,
          ...helpers.withAuthorization(tokens),
          payload: helpers.defaultUserState()
        });
        // expect that user was appeared in the first channel
        let list = await connectionService.getChannelConnections(channel1.id);
        expect(list.map(c => c.userId)).includes(user.id);
        // select the second channel
        await server.inject({
          method: 'POST',
          url: `/channels/${channel2.id}/select?socketId=${conn.connectionId}`,
          ...helpers.withAuthorization(tokens),
          payload: helpers.defaultUserState()
        });
        // expect that user was appeared in the second channel and was disappeared from the first
        list = await connectionService.getChannelConnections(channel1.id);
        expect(list.map(c => c.userId)).not.includes(user.id);
        list = await connectionService.getChannelConnections(channel2.id);
        expect(list.map(c => c.userId)).includes(user.id);
      });
    });
  });

  describe('POST /channels/{channelId}/unselect', () => {
    describe('User tries to unselect channel, but he hasnt selected it', () => {
      it('should return 400 Bad request', async () => {
        const {
          userService,
          workspaceService
        } = server.services();

        const user = await userService.signup({ email: 'admin@admin.ru', name: 'name' });
        const { workspace } = await workspaceService.createWorkspace(user, 'name');
        const channel = await workspaceService.createChannel(workspace.id, user.id, {
          name: 'testChannel',
          isPrivate: false,
          lifespan: 2000
        });
        const tokens = await userService.createTokens(user);
        // try to unselect the channel
        const response = await server.inject({
          method: 'POST',
          url: `/channels/${channel.id}/unselect?socketId=${uuid4()}`,
          ...helpers.withAuthorization(tokens)
        });
        expect(response.statusCode).equals(400);
        const payload = JSON.parse(response.payload);
        expect(payload.message).equals('Channel is not selected');
      });
    });
    describe('User tries to unselect channel on another device', () => {
      it('should return 400 Bad request', async () => {
        const {
          userService,
          workspaceService,
          connectionService
        } = server.services();

        const user = await userService.signup({ email: 'admin@admin.ru', name: 'name' });
        const { workspace } = await workspaceService.createWorkspace(user, 'name');
        const channel = await workspaceService.createChannel(workspace.id, user.id, {
          name: 'testChannel',
          isPrivate: false,
          lifespan: 2000
        });
        const tokens = await userService.createTokens(user);
        const conn = generateFakeConnection(user.id, workspace.id);
        await connectionService.setConnectionObject(conn);
        const conn2 = generateFakeConnection(user.id, workspace.id);
        await connectionService.setConnectionObject(conn2);
        // select the channel
        const selectResponse = await server.inject({
          method: 'POST',
          url: `/channels/${channel.id}/select?socketId=${conn.connectionId}`,
          ...helpers.withAuthorization(tokens),
          payload: helpers.defaultUserState()
        });
        expect(selectResponse.statusCode).equals(200);
        // try to unselect the channel
        const response = await server.inject({
          method: 'POST',
          url: `/channels/${channel.id}/unselect?socketId=${conn2}`,
          ...helpers.withAuthorization(tokens)
        });
        expect(response.statusCode).equals(400);
        const payload = JSON.parse(response.payload);
        expect(payload.message).equals('Channel is not selected');
      });
    });
    describe('User unselect channel that was tmp', () => {
      it('should delete channel', async () => {
        const {
          userService,
          workspaceService,
          channelDatabaseService: chdb,
          connectionService
        } = server.services();

        const user = await userService.signup({ email: 'admin@admin.ru', name: 'name' });
        const { workspace } = await workspaceService.createWorkspace(user, 'name');
        const channel = await workspaceService.createChannel(workspace.id, user.id, {
          name: 'testChannel',
          isPrivate: false,
          lifespan: 1
        });
        const tokens = await userService.createTokens(user);
        const conn = generateFakeConnection(user.id, workspace.id);
        await connectionService.setConnectionObject(conn);
        // select the channel
        const selectResponse = await server.inject({
          method: 'POST',
          url: `/channels/${channel.id}/select?socketId=${conn.connectionId}`,
          ...helpers.withAuthorization(tokens),
          payload: helpers.defaultUserState()
        });
        expect(selectResponse.statusCode).equals(200);
        await new Promise(resolve => setTimeout(resolve, 1));
        // try to unselect the channel
        const response = await server.inject({
          method: 'POST',
          url: `/channels/${channel.id}/unselect?socketId=${conn.connectionId}`,
          ...helpers.withAuthorization(tokens)
        });

        expect(response.statusCode).equals(200);
        // channel should be deleted
        const channelFromDb = await chdb.getChannelById(channel.id);
        expect(channelFromDb).not.exists();
      });
      it('should delete channel from janus too', async () => {
        const {
          userService,
          workspaceService,
          connectionService,
          channelDatabaseService: chdb
        } = server.services();

        const user = await userService.signup({ email: 'admin@admin.ru', name: 'name' });
        const { workspace } = await workspaceService.createWorkspace(user, 'name');
        const channel = await workspaceService.createChannel(workspace.id, user.id, {
          name: 'testChannel',
          isPrivate: false,
          lifespan: 1
        });
        const tokens = await userService.createTokens(user);
        const conn = generateFakeConnection(user.id, workspace.id);
        await connectionService.setConnectionObject(conn);
        // select the channel
        const selectResponse = await server.inject({
          method: 'POST',
          url: `/channels/${channel.id}/select?socketId=${conn.connectionId}`,
          ...helpers.withAuthorization(tokens),
          payload: helpers.defaultUserState()
        });
        expect(selectResponse.statusCode).equals(200);
        await new Promise(resolve => setTimeout(resolve, 1));
        // try to unselect the channel
        const response = await server.inject({
          method: 'POST',
          url: `/channels/${channel.id}/unselect?socketId=${conn.connectionId}`,
          ...helpers.withAuthorization(tokens)
        });

        expect(response.statusCode).equals(200);
        // channel should be deleted from janus
        expect(stubbedMethods.deleteAudioVideoRooms.getCalls().length).equals(1);
        const janusOpts = await chdb.getJanusForChannel(channel.id);
        expect(stubbedMethods.deleteAudioVideoRooms.firstCall.args[0][0].audioRoomId).equals(janusOpts.audioRoomId);
      });
    });
    describe('User unselect channel that was tmp, but there are another users which are in the channel', () => {
      it('shouldnt delete channel', async () => {
        const {
          userService,
          workspaceService,
          channelDatabaseService: chdb,
          connectionService
        } = server.services();

        const user = await userService.signup({ email: 'admin@admin.ru', name: 'name' });
        const user2 = await userService.signup({ email: 'admin2@admin.ru', name: 'name' });
        const { workspace } = await workspaceService.createWorkspace(user, 'name');
        await workspaceService.addUserToWorkspace(workspace.id, user2.id);
        const channel = await workspaceService.createChannel(workspace.id, user.id, {
          name: 'testChannel',
          isPrivate: false,
          lifespan: 1
        });
        const tokens = await userService.createTokens(user);
        const tokens2 = await userService.createTokens(user2);
        const conn = generateFakeConnection(user.id, workspace.id);
        const conn2 = generateFakeConnection(user2.id, workspace.id);
        await connectionService.setConnectionObject(conn);
        await connectionService.setConnectionObject(conn2);
        // select the channel
        const selectResponse = await server.inject({
          method: 'POST',
          url: `/channels/${channel.id}/select?socketId=${conn.connectionId}`,
          ...helpers.withAuthorization(tokens),
          payload: helpers.defaultUserState()
        });
        expect(selectResponse.statusCode).equals(200);
        // select channel by another user
        const selectResponse2 = await server.inject({
          method: 'POST',
          url: `/channels/${channel.id}/select?socketId=${conn2.connectionId}`,
          ...helpers.withAuthorization(tokens2),
          payload: helpers.defaultUserState()
        });
        expect(selectResponse2.statusCode).equals(200);
        await new Promise(resolve => setTimeout(resolve, 1));
        // try to unselect the channel
        const response = await server.inject({
          method: 'POST',
          url: `/channels/${channel.id}/unselect?socketId=${conn.connectionId}`,
          ...helpers.withAuthorization(tokens)
        });

        expect(response.statusCode).equals(200);
        // channel should be deleted
        const channelFromDb = await chdb.getChannelById(channel.id);
        expect(channelFromDb).exists();
      });
      it('shouldnt delete only auth tokens for that user', async () => {
        const {
          userService,
          workspaceService,
          connectionService
        } = server.services();

        const user = await userService.signup({ email: 'admin@admin.ru', name: 'name' });
        const user2 = await userService.signup({ email: 'admin2@admin.ru', name: 'name' });
        const { workspace } = await workspaceService.createWorkspace(user, 'name');
        await workspaceService.addUserToWorkspace(workspace.id, user2.id);
        const channel = await workspaceService.createChannel(workspace.id, user.id, {
          name: 'testChannel',
          isPrivate: false,
          lifespan: 1
        });
        const tokens = await userService.createTokens(user);
        const tokens2 = await userService.createTokens(user2);
        const conn = generateFakeConnection(user.id, workspace.id);
        const conn2 = generateFakeConnection(user2.id, workspace.id);
        await connectionService.setConnectionObject(conn);
        await connectionService.setConnectionObject(conn2);
        // select the channel
        const selectResponse = await server.inject({
          method: 'POST',
          url: `/channels/${channel.id}/select?socketId=${conn.connectionId}`,
          ...helpers.withAuthorization(tokens),
          payload: helpers.defaultUserState()
        });
        expect(selectResponse.statusCode).equals(200);
        // select channel by another user
        const selectResponse2 = await server.inject({
          method: 'POST',
          url: `/channels/${channel.id}/select?socketId=${conn2.connectionId}`,
          ...helpers.withAuthorization(tokens2),
          payload: helpers.defaultUserState()
        });
        expect(selectResponse2.statusCode).equals(200);
        await new Promise(resolve => setTimeout(resolve, 1));
        const userConn1 = await connectionService.getConnection(conn.connectionId);
        // try to unselect the channel
        const response = await server.inject({
          method: 'POST',
          url: `/channels/${channel.id}/unselect?socketId=${conn.connectionId}`,
          ...helpers.withAuthorization(tokens)
        });

        expect(response.statusCode).equals(200);

        // check that channel wasnt deleted from janus
        expect(stubbedMethods.deleteAudioVideoRooms.notCalled).true();
        // check that tokens was deleted
        expect(stubbedMethods.manageAuthTokensForChannel.thirdCall.args[0][0]).equals('remove');
        expect(stubbedMethods.manageAuthTokensForChannel.thirdCall.args[0][1][0])
          .equals(userConn1.janusChannelAuthToken);
        expect(stubbedMethods.deleteAuthTokenForWorkspace.firstCall.args[0][0]).equals(userConn1.janusServerAuthToken);
      });
    });
    describe('User unselect channel that was tmp without lifespan', () => {
      it('should delete channel', async () => {
        const {
          userService,
          workspaceService,
          channelDatabaseService: chdb,
          connectionService
        } = server.services();

        const user = await userService.signup({ email: 'admin@admin.ru', name: 'name' });
        const { workspace } = await workspaceService.createWorkspace(user, 'name');
        const channel = await workspaceService.createChannel(workspace.id, user.id, {
          name: 'testChannel',
          isPrivate: true,
          isTemporary: true
        });
        const tokens = await userService.createTokens(user);
        const conn = generateFakeConnection(user.id, workspace.id);
        await connectionService.setConnectionObject(conn);
        // select the channel
        const selectResponse = await server.inject({
          method: 'POST',
          url: `/channels/${channel.id}/select?socketId=${conn.connectionId}`,
          ...helpers.withAuthorization(tokens),
          payload: helpers.defaultUserState()
        });
        expect(selectResponse.statusCode).equals(200);
        await new Promise(resolve => setTimeout(resolve, 1));
        // try to unselect the channel
        const response = await server.inject({
          method: 'POST',
          url: `/channels/${channel.id}/unselect?socketId=${conn.connectionId}`,
          ...helpers.withAuthorization(tokens)
        });

        expect(response.statusCode).equals(200);
        // channel should be deleted
        const channelFromDb = await chdb.getChannelById(channel.id);
        expect(channelFromDb).not.exists();
      });
    });
  });

  describe('POST /channels/{channelId}/leave', () => {
    describe('The last user leave the channel', () => {
      it('should delete channel', async () => {
        const {
          userService,
          workspaceService,
          channelDatabaseService: chdb
        } = server.services();
        const user = await userService.signup({ email: 'user@admin.ru' });
        const tokens = await userService.createTokens(user);
        const { workspace } = await workspaceService.createWorkspace(user, 'test');
        const channel = await workspaceService.createChannel(workspace.id, user.id, {
          name: 'test',
          isPrivate: false
        });
        const response = await server.inject({
          method: 'POST',
          url: `/channels/${channel.id}/leave`,
          ...helpers.withAuthorization(tokens)
        });
        expect(response.statusCode).equals(200);
        const channelFromDb = await chdb.getChannelById(channel.id);
        expect(channelFromDb).not.exist();
      });
    });
  });

  describe('POST /channels/{channelId}', () => {
    describe('Try to modify channel by not admin user and not creator', () => {
      it('should return 403 error', async () => {
        const {
          userService,
          workspaceService,
        } = server.services();
        const user = await userService.signup({ email: 'test@user.ru' });
        const user2 = await userService.signup({ email: 'test2@user.ru' });
        const { workspace } = await workspaceService.createWorkspace(user, 'test');
        await workspaceService.addUserToWorkspace(workspace.id, user2.id);
        const channel = await workspaceService.createChannel(workspace.id, user.id, {
          name: 'test',
          isPrivate: true
        });
        const tokens = await userService.createTokens(user2);
        const response = await server.inject({
          method: 'POST',
          url: `/channels/${channel.id}`,
          ...helpers.withAuthorization(tokens),
          payload: {
            name: 'test-modified',
            description: 'set description'
          }
        });
        expect(response.statusCode).equals(403);
      });
    });
    describe('Modify channel by admin, moderator and creator', () => {
      it('channel should be modified', async () => {
        const {
          userService,
          workspaceService,
          channelDatabaseService: chdb,
        } = server.services();
        const admin = await userService.signup({ email: 'admin@user.ru' });
        const moderator = await userService.signup({ email: 'moderator@user.ru' });
        const creator = await userService.signup({ email: 'creator@user.ru' });
        const { workspace } = await workspaceService.createWorkspace(admin, 'test');
        await workspaceService.addUserToWorkspace(workspace.id, moderator.id, 'moderator');
        await workspaceService.addUserToWorkspace(workspace.id, creator.id);
        const channel = await workspaceService.createChannel(workspace.id, creator.id, {
          name: 'test',
          description: 'desc',
          isPrivate: false
        });

        // creator modify channel
        const creatorTokens = await userService.createTokens(creator);
        const response1 = await server.inject({
          method: 'POST',
          url: `/channels/${channel.id}`,
          ...helpers.withAuthorization(creatorTokens),
          payload: {
            name: 'creator-modified-channel',
            description: 'creator-modified-channel'
          }
        });
        expect(response1.statusCode).equals(200);
        const ch1 = await chdb.getChannelById(channel.id);
        expect(ch1.name).equals('creator-modified-channel');
        expect(ch1.description).equals('creator-modified-channel');

        // moderator modify channel
        const moderatorTokens = await userService.createTokens(moderator);
        const response2 = await server.inject({
          method: 'POST',
          url: `/channels/${channel.id}`,
          ...helpers.withAuthorization(moderatorTokens),
          payload: {
            name: 'moderator-modified-channel',
            description: 'moderator-modified-channel'
          }
        });
        expect(response2.statusCode).equals(200);
        const ch2 = await chdb.getChannelById(channel.id);
        expect(ch2.name).equals('moderator-modified-channel');
        expect(ch2.description).equals('moderator-modified-channel');

        // admin modify channel
        const adminTokens = await userService.createTokens(moderator);
        const response3 = await server.inject({
          method: 'POST',
          url: `/channels/${channel.id}`,
          ...helpers.withAuthorization(adminTokens),
          payload: {
            name: 'admin-modified-channel',
            description: 'admin-modified-channel'
          }
        });
        expect(response3.statusCode).equals(200);
        const ch3 = await chdb.getChannelById(channel.id);
        expect(ch3.name).equals('admin-modified-channel');
        expect(ch3.description).equals('admin-modified-channel');
      });
    });
  });

  describe('DELETE /channels/{channelId}', () => {
    describe('Try to delete channel by not admin user and not creator', () => {
      it('should return 403 error', async () => {
        const {
          userService,
          workspaceService,
        } = server.services();
        const user = await userService.signup({ email: 'test@user.ru' });
        const user2 = await userService.signup({ email: 'test2@user.ru' });
        const { workspace } = await workspaceService.createWorkspace(user, 'test');
        await workspaceService.addUserToWorkspace(workspace.id, user2.id);
        const channel = await workspaceService.createChannel(workspace.id, user.id, {
          name: 'test',
          isPrivate: true
        });
        const tokens = await userService.createTokens(user2);
        const response = await server.inject({
          method: 'DELETE',
          url: `/channels/${channel.id}`,
          ...helpers.withAuthorization(tokens),
        });
        expect(response.statusCode).equals(403);
      });
    });
    describe('Delete channel by admin, moderator and creator', () => {
      it('channel should be deleted', async () => {
        const {
          userService,
          workspaceService,
          channelDatabaseService: chdb,
        } = server.services();
        const admin = await userService.signup({ email: 'admin@user.ru' });
        const { workspace } = await workspaceService.createWorkspace(admin, 'test');
        const channel = await workspaceService.createChannel(workspace.id, admin.id, {
          name: 'test',
          description: 'desc',
          isPrivate: false
        });

        // creator delete channel
        const tokens = await userService.createTokens(admin);
        const response1 = await server.inject({
          method: 'DELETE',
          url: `/channels/${channel.id}`,
          ...helpers.withAuthorization(tokens)
        });
        expect(response1.statusCode).equals(200);
        const ch1 = await chdb.getChannelById(channel.id);
        expect(ch1).not.exists();
      });
    });
  });

  describe('GET /channels/{channelId}/active-users', () => {
    describe('Get request', () => {
      it('should return a valid active users list', async () => {
        const {
          userService,
          workspaceService,
          channelService,
          connectionService
        } = server.services();
        const user = await userService.signup({ email: 'test@user.ru' });
        const user2 = await userService.signup({ email: 'test2@user.ru' });
        const { workspace } = await workspaceService.createWorkspace(user, 'test');
        await workspaceService.addUserToWorkspace(workspace.id, user2.id);
        const channel = await workspaceService.createChannel(workspace.id, user.id, {
          name: 'test',
          isPrivate: false
        });
        const tokens = await userService.createTokens(user);
        const conn2 = generateFakeConnection(user2.id, workspace.id);
        await connectionService.setConnectionObject(conn2);
        await channelService.selectChannel(channel.id, user2.id, conn2.connectionId, helpers.defaultUserState());
        const response = await server.inject({
          method: 'GET',
          url: `/channels/${channel.id}/active-users`,
          ...helpers.withAuthorization(tokens),
        });
        expect(response.statusCode).equals(200);
        const payload = JSON.parse(response.payload);
        expect(payload.length).equals(1);
        expect(payload[0].userId).equals(user2.id);
      });
    });
  });

  describe('GET /channels/{channelId}', () => {
    describe('User who hasnt acces to channel try to request', () => {
      it('return 403 error', async () => {
        const {
          userService,
          workspaceService,
        } = server.services();
        const user = await userService.signup({ email: 'test@user.ru' });
        const user2 = await userService.signup({ email: 'test2@user.ru' });
        const { workspace } = await workspaceService.createWorkspace(user, 'test');
        await workspaceService.addUserToWorkspace(workspace.id, user2.id);
        const channel = await workspaceService.createChannel(workspace.id, user.id, {
          name: 'test',
          isPrivate: true
        });
        const tokens = await userService.createTokens(user2);
        const response = await server.inject({
          method: 'GET',
          url: `/channels/${channel.id}`,
          ...helpers.withAuthorization(tokens)
        });
        expect(response.statusCode).equals(403);
      });
    });
    describe('Request channel info', () => {
      it('return 403 error', async () => {
        const {
          userService,
          workspaceService,
        } = server.services();
        const user = await userService.signup({ email: 'test@user.ru' });
        const { workspace } = await workspaceService.createWorkspace(user, 'test');
        const channel = await workspaceService.createChannel(workspace.id, user.id, {
          name: 'test',
          isPrivate: true,
          isTemporary: true
        });
        const tokens = await userService.createTokens(user);
        const response = await server.inject({
          method: 'GET',
          url: `/channels/${channel.id}`,
          ...helpers.withAuthorization(tokens)
        });
        expect(response.statusCode).equals(200);
        const payload = JSON.parse(response.payload);
        expect(payload.channel.name).equals('test');
        expect(payload.channel.isPrivate).equals(true);
        expect(payload.channel.isTemporary).equals(true);
      });
    });
  });

  describe('POST /channels/{channelId}/invite', () => {
    describe('Check that guest cant invite to channel', () => {
      it('should return 403 error', async () => {
        const {
          userService,
          workspaceService,
        } = server.services();

        const user = await userService.signup({
          name: 'admin',
        });
        const { workspace } = await workspaceService.createWorkspace(user, 'test');
        const guest = await userService.signup({
          name: 'guest',
        });
        const channel = await workspaceService.createChannel(workspace.id, user.id, {
          name: 'channel',
        });
        await workspaceService.addUserToWorkspace(workspace.id, guest.id, 'guest', [ channel.id ]);
        const guestTokens = await userService.createTokens(guest);
        const response = await server.inject({
          method: 'POST',
          url: `/channels/${channel.id}/invite`,
          ...helpers.withAuthorization(guestTokens)
        });
        expect(response.statusCode).equals(403);
      });
    });
    describe('Check that an invite code was successfully created', () => {
      it('should return 200 and invite code', async () => {
        const {
          userService,
          workspaceService,
        } = server.services();

        const user = await userService.signup({
          name: 'admin',
        });
        const { workspace } = await workspaceService.createWorkspace(user, 'test');
        const channel = await workspaceService.createChannel(workspace.id, user.id, {
          name: 'channel',
        });
        const tokens = await userService.createTokens(user);
        const response = await server.inject({
          method: 'POST',
          url: `/channels/${channel.id}/invite`,
          ...helpers.withAuthorization(tokens)
        });
        expect(response.statusCode).equals(200);
        const payload = JSON.parse(response.payload);
        expect(payload.token).exists();
      });
    });
    describe('Check that user can not create two invites in the same channel', () => {
      it('If there is an actual invite in this channel, return it', async () => {
        const {
          userService,
          workspaceService,
        } = server.services();

        const user = await userService.signup({
          name: 'admin',
        });
        const { workspace } = await workspaceService.createWorkspace(user, 'test');
        const channel = await workspaceService.createChannel(workspace.id, user.id, {
          name: 'channel',
        });
        const tokens = await userService.createTokens(user);
        const response = await server.inject({
          method: 'POST',
          url: `/channels/${channel.id}/invite`,
          ...helpers.withAuthorization(tokens)
        });
        expect(response.statusCode).equals(200);
        const id = response.result.id;
        expect(id).exists();
        const response2 = await server.inject({
          method: 'POST',
          url: `/channels/${channel.id}/invite`,
          ...helpers.withAuthorization(tokens),
        });
        expect(response2.statusCode).equals(200);
        expect(response2.result.id).equals(id);
      });
    });
  });
  describe('GET /channels/${channelId}/invite', () => {
    it('Get an actual invite for channel', async () => {
      const {
        userService,
        workspaceService,
      } = server.services();

      const user = await userService.signup({
        name: 'admin',
      });
      const { workspace } = await workspaceService.createWorkspace(user, 'test');
      const channel = await workspaceService.createChannel(workspace.id, user.id, {
        name: 'channel',
      });
      const tokens = await userService.createTokens(user);
      const response = await server.inject({
        method: 'POST',
        url: `/channels/${channel.id}/invite`,
        ...helpers.withAuthorization(tokens)
      });
      expect(response.statusCode).equals(200);
      const id = response.result.id;
      expect(id).exists();

      const response2 = await server.inject({
        method: 'GET',
        url: `/channels/${channel.id}/invite`,
        ...helpers.withAuthorization(tokens),
      });
      expect(response2.statusCode).equals(200);
      expect(response2.result.id).equals(id);
    });
    it('Check that actual invite not expired', async () => {
      const {
        userService,
        workspaceService,
      } = server.services();

      const user = await userService.signup({
        name: 'admin',
      });
      const { workspace } = await workspaceService.createWorkspace(user, 'test');
      const channel = await workspaceService.createChannel(workspace.id, user.id, {
        name: 'channel',
      });
      const tokens = await userService.createTokens(user);
      const response = await server.inject({
        method: 'POST',
        url: `/channels/${channel.id}/invite`,
        ...helpers.withAuthorization(tokens)
      });
      expect(response.statusCode).equals(200);
      const id = response.result.id;
      expect(id).exists();

      const db = server.plugins['hapi-pg-promise'].db;
      await db.none('UPDATE invites SET expired_at = $1 WHERE id=$2', [
        new Date(Date.now() - 2000),
        response.result.id,
      ]);

      const response2 = await server.inject({
        method: 'GET',
        url: `/channels/${channel.id}/invite`,
        ...helpers.withAuthorization(tokens),
      });
      expect(response2.statusCode).equals(404);
    });
  });
  describe('POST /channel-invites/${inviteId}/deactivate', () => {
    it('Channel invite can be deleted by any workspace user', async () => {
      const {
        userService,
        workspaceService,
      } = server.services();

      const admin = await userService.signup({
        name: 'admin',
      });
      const user = await userService.signup({
        name: 'user',
      });
      const { workspace } = await workspaceService.createWorkspace(admin, 'test');
      await workspaceService.addUserToWorkspace(workspace.id, user.id);
      const channel = await workspaceService.createChannel(workspace.id, admin.id, {
        name: 'channel',
      });
      const tokens = await userService.createTokens(admin);
      const userTokens = await userService.createTokens(user);
      const response = await server.inject({
        method: 'POST',
        url: `/channels/${channel.id}/invite`,
        ...helpers.withAuthorization(tokens)
      });
      expect(response.statusCode).equals(200);
      const id = response.result.id;
      expect(id).exists();

      const response2 = await server.inject({
        method: 'POST',
        url: `/channel-invites/${id}/deactivate`,
        ...helpers.withAuthorization(userTokens),
      });
      expect(response2.statusCode).equals(200);
      expect(response2.result).equals('ok');

      const response3 = await server.inject({
        method: 'GET',
        url: `/channels/${channel.id}/invite`,
        ...helpers.withAuthorization(userTokens),
      });
      expect(response3.statusCode).equals(404);
    });
  });

  describe('POST /channels/join/{code}', () => {
    describe('Check that code is expired', () => {
      it('should return 400 bad request', async () => {
        const {
          userService,
          workspaceService,
          channelService,
        } = server.services();

        const user = await userService.signup({
          name: 'admin',
        });
        const { workspace } = await workspaceService.createWorkspace(user, 'test');
        const channel = await workspaceService.createChannel(workspace.id, user.id, {
          name: 'channel',
        });
        const inviteToken = await channelService.getInviteChannelToken(channel.id, user.id);
        MockDate.set(Date.now() + 60 * 24 * 3500 * 1000);
        const response = await server.inject({
          method: 'POST',
          url: `/channels/join/${inviteToken}`,
          payload: {
            name: 'TEST_USER',
          }
        });
        MockDate.reset();
        expect(response.statusCode).equals(400);
      });
    });
    describe('User successfully joined the channel', () => {
      it('should return 200 and user data and access token', async () => {
        const {
          userService,
          workspaceService,
          channelService,
        } = server.services();

        const user = await userService.signup({
          name: 'admin',
        });
        const { workspace } = await workspaceService.createWorkspace(user, 'test');
        const channel = await workspaceService.createChannel(workspace.id, user.id, {
          name: 'channel',
        });
        const { code: inviteToken } = await channelService.getInviteChannelToken(channel.id, user.id);

        const response = await server.inject({
          method: 'POST',
          url: `/channels/join/${inviteToken}`,
          payload: {
            name: 'TEST_USER',
          }
        });
        expect(response.statusCode).equals(200);
        const payload = JSON.parse(response.payload);
        expect(payload.credentials.accessToken).exists();
        expect(payload.user.name).equals('TEST_USER');
      });
    });
  });

  describe('DELETE /channels/{channelId/invites', () => {
    describe('Delete all channel invites with revoking access', () => {
      it('Invite should be deleted, access should be revoked', async () => {
        const {
          userService,
          workspaceService,
          channelService,
          workspaceDatabaseService: wdb,
          inviteCodesDatabaseService: invdb,
        } = server.services();
        const user = await userService.signup({ name: 'user' });
        const { workspace } = await workspaceService.createWorkspace(user, 'test');
        const tokens = await userService.createTokens(user);
        const channel = await workspaceService.createChannel(workspace.id, user.id, {
          name: 'global'
        });
        const { code: inviteToken1 } = await channelService.getInviteChannelToken(channel.id, user.id);

        // sign up with these invites
        const response1 = await server.inject({
          method: 'POST',
          url: `/channels/join/${inviteToken1}`,
          payload: {
            name: 'guest1',
          }
        });
        expect(response1.statusCode).equals(200);
        const response2 = await server.inject({
          method: 'POST',
          url: `/channels/join/${inviteToken1}`,
          payload: {
            name: 'guest2',
          }
        });
        expect(response2.statusCode).equals(200);
        const response3 = await server.inject({
          method: 'POST',
          url: `/channels/join/${inviteToken1}`,
          payload: {
            name: 'guest3',
          }
        });
        expect(response3.statusCode).equals(200);

        // check that there are 4 users in workspace
        const members = await wdb.getWorkspaceMembers(workspace.id);
        expect(members).length(4);

        const invites = await invdb.getInvitesByChannel(channel.id);
        expect(invites).length(1);

        // delete invite with revoking access
        const response4 = await server.inject({
          method: 'DELETE',
          url: `/channels/${channel.id}/invites?revokeAccess=true`,
          ...helpers.withAuthorization(tokens)
        });
        expect(response4.statusCode).equals(200);

        // check that invite doesnt exist
        const invitesAfterDelete = await invdb.getInvitesByChannel(channel.id);
        expect(invitesAfterDelete).length(0);

        // check that there is only one user in workspace
        const membersAfterDelete = await wdb.getWorkspaceMembers(workspace.id);
        expect(membersAfterDelete).length(1);
      });
    });
  });

  describe('GET /channels/{channelId}/members', () => {
    it('Should return list of members of private channel', async () => {
      const {
        userService,
        workspaceService,
      } = server.services();
      const user = await userService.signup({ email: 'test@user.ru', name: 'abc1', });
      const user2 = await userService.signup({ email: 'test2@user.ru', name: 'bac2', });
      const user3 = await userService.signup({ email: 'test3@user.ru', name: 'cba3', });
      const { workspace } = await workspaceService.createWorkspace(user, 'test');
      await workspaceService.addUserToWorkspace(workspace.id, user2.id);
      await workspaceService.addUserToWorkspace(workspace.id, user3.id);
      const channel = await workspaceService.createChannel(workspace.id, user.id, {
        name: 'test',
        isPrivate: true
      });
      await workspaceService.addMembersToChannel(channel.id, workspace.id, [
        user2.id,
        user3.id,
      ]);
      const tokens = await userService.createTokens(user);
      const response = await server.inject({
        method: 'GET',
        url: `/channels/${channel.id}/members`,
        ...helpers.withAuthorization(tokens)
      });
      expect(response.statusCode).equals(200);
      expect(response.result).array();
      expect(response.result).length(3);
    });
  });

  describe('POST /channels/{channelId}/add-users', () => {
    it('Try to add several users in private channel', async () => {
      const {
        userService,
        workspaceService,
        channelDatabaseService: chdb,
      } = server.services();
      const user = await userService.signup({ email: 'test@user.ru', name: 'abc1', });
      const user2 = await userService.signup({ email: 'test2@user.ru', name: 'bac2', });
      const user3 = await userService.signup({ email: 'test3@user.ru', name: 'cba3', });
      const { workspace } = await workspaceService.createWorkspace(user, 'test');
      await workspaceService.addUserToWorkspace(workspace.id, user2.id);
      await workspaceService.addUserToWorkspace(workspace.id, user3.id);
      const channel = await workspaceService.createChannel(workspace.id, user.id, {
        name: 'test',
        isPrivate: true
      });
      const tokens = await userService.createTokens(user);
      const response = await server.inject({
        method: 'POST',
        url: `/channels/${channel.id}/add-users`,
        payload: {
          users: [user2.id, user3.id],
        },
        ...helpers.withAuthorization(tokens)
      });
      expect(response.statusCode).equals(200);

      // check that users is added
      const channelMembers = await chdb.getAllChannelMembers(channel.id);
      expect(channelMembers).length(3);
    });
  });

  describe('POST /channels/{channelId}/delete-users', () => {
    it('Try to delete several users from private channel', async () => {
      const {
        userService,
        workspaceService,
        channelDatabaseService: chdb,
      } = server.services();
      const user = await userService.signup({ email: 'test@user.ru', name: 'abc1', });
      const user2 = await userService.signup({ email: 'test2@user.ru', name: 'bac2', });
      const user3 = await userService.signup({ email: 'test3@user.ru', name: 'cba3', });
      const { workspace } = await workspaceService.createWorkspace(user, 'test');
      await workspaceService.addUserToWorkspace(workspace.id, user2.id);
      await workspaceService.addUserToWorkspace(workspace.id, user3.id);
      const channel = await workspaceService.createChannel(workspace.id, user.id, {
        name: 'test',
        isPrivate: true
      });
      await workspaceService.addMembersToChannel(channel.id, workspace.id, [
        user2.id,
        user3.id,
      ]);
      const tokens = await userService.createTokens(user);
      const response = await server.inject({
        method: 'POST',
        url: `/channels/${channel.id}/delete-users`,
        payload: {
          users: [user2.id, user3.id],
        },
        ...helpers.withAuthorization(tokens)
      });
      expect(response.statusCode).equals(200);

      // check that users is added
      const channelMembers = await chdb.getAllChannelMembers(channel.id);
      expect(channelMembers).length(1);
    });
  });

  describe('POST /channels/{channelId}/permissions', () => {
    it('Try to delete last admin from channel, should return 400', async () => {
      const {
        userService,
        workspaceService,
      } = server.services();
      const user = await userService.signup({ email: 'test@user.ru', name: 'abc1', });
      const user2 = await userService.signup({ email: 'test2@user.ru', name: 'bac2', });
      const user3 = await userService.signup({ email: 'test3@user.ru', name: 'cba3', });
      const { workspace } = await workspaceService.createWorkspace(user, 'test');
      await workspaceService.addUserToWorkspace(workspace.id, user2.id);
      await workspaceService.addUserToWorkspace(workspace.id, user3.id);
      const channel = await workspaceService.createChannel(workspace.id, user.id, {
        name: 'test',
        isPrivate: true
      });
      await workspaceService.addMembersToChannel(channel.id, workspace.id, [
        user2.id,
        user3.id,
      ]);
      const tokens = await userService.createTokens(user);
      const response = await server.inject({
        method: 'POST',
        url: `/channels/${channel.id}/permissions`,
        payload: {
          userId: user.id,
          role: 'user',
        },
        ...helpers.withAuthorization(tokens)
      });
      expect(response.statusCode).equals(400);
    });
    it('Change member role to "admin" for user', async () => {
      const {
        userService,
        workspaceService,
        channelDatabaseService: chdb,
      } = server.services();
      const user = await userService.signup({ email: 'test@user.ru', name: 'abc1', });
      const user2 = await userService.signup({ email: 'test2@user.ru', name: 'bac2', });
      const user3 = await userService.signup({ email: 'test3@user.ru', name: 'cba3', });
      const { workspace } = await workspaceService.createWorkspace(user, 'test');
      await workspaceService.addUserToWorkspace(workspace.id, user2.id);
      await workspaceService.addUserToWorkspace(workspace.id, user3.id);
      const channel = await workspaceService.createChannel(workspace.id, user.id, {
        name: 'test',
        isPrivate: true
      });
      await workspaceService.addMembersToChannel(channel.id, workspace.id, [
        user2.id,
        user3.id,
      ]);
      const tokens = await userService.createTokens(user);
      const response = await server.inject({
        method: 'POST',
        url: `/channels/${channel.id}/permissions`,
        payload: {
          userId: user2.id,
          role: 'admin',
        },
        ...helpers.withAuthorization(tokens)
      });
      expect(response.statusCode).equals(200);

      const channelMembers = await chdb.getAllChannelMembers(channel.id);
      const admins = channelMembers.find(u => u.channel_role === 'admin' && u.id === user2.id);
      expect(admins).exist();
    });
    it('Try to change role for not member', async () => {
      const {
        userService,
        workspaceService,
      } = server.services();
      const user = await userService.signup({ email: 'test@user.ru', name: 'abc1', });
      const user2 = await userService.signup({ email: 'test2@user.ru', name: 'bac2', });
      const user3 = await userService.signup({ email: 'test3@user.ru', name: 'cba3', });
      const { workspace } = await workspaceService.createWorkspace(user, 'test');
      await workspaceService.addUserToWorkspace(workspace.id, user2.id);
      await workspaceService.addUserToWorkspace(workspace.id, user3.id);
      const channel = await workspaceService.createChannel(workspace.id, user.id, {
        name: 'test',
        isPrivate: true
      });
      await workspaceService.addMembersToChannel(channel.id, workspace.id, [
        user2.id,
      ]);
      const tokens = await userService.createTokens(user);
      const response = await server.inject({
        method: 'POST',
        url: `/channels/${channel.id}/permissions`,
        payload: {
          userId: user3.id,
          role: 'admin',
        },
        ...helpers.withAuthorization(tokens)
      });
      expect(response.statusCode).equals(400);
    });
  });

  /**
   * Invites
   */
  describe('POST /workspaces/{workspaceId}/invites', () => {
    describe('User tries to create invite, but he hasnt a permission to do it', () => {
      it('should return 403 (Forbidden) code', async () => {
        const {
          userService,
          workspaceService
        } = server.services();
        // create users
        const admin = await userService.signup({ email: 'admin@user.net' });
        const guest = await userService.signup({ email: 'guest@user.net' });
        // create tokens
        const tokens = await userService.createTokens(guest);
        // create workspace
        const { workspace } = await workspaceService.createWorkspace(admin, 'testWorkspace');
        // add guest to the workspace as a guest
        await workspaceService.addUserToWorkspace(workspace.id, guest.id, 'guest');
        const response = await server.inject({
          method: 'POST',
          url: `/workspaces/${workspace.id}/invites`,
          headers: {
            'Authorization': `Bearer ${tokens.accessToken}`
          }
        });
        expect(response.statusCode).to.be.equal(403);
      });
    });
    describe('User has a permission to create invites', () => {
      it('should return 200 status and invite code', async () => {
        const {
          userService,
          workspaceService
        } = server.services();
        // create users
        const admin = await userService.signup({ email: 'admin@user.net' });
        // create tokens
        const tokens = await userService.createTokens(admin);
        // create workspace
        const { workspace } = await workspaceService.createWorkspace(admin, 'testWorkspace');
        const response = await server.inject({
          method: 'POST',
          url: `/workspaces/${workspace.id}/invites`,
          headers: {
            'Authorization': `Bearer ${tokens.accessToken}`
          }
        });
        expect(response.statusCode).to.be.equal(200);
        const body = JSON.parse(response.payload);
        expect(body.code).exists();
        //ensure that it is a guid + code
        expect(body.code).exists();
      });
    });
    describe('Workspace set up that users cannot create invites, but user tries', () => {
      it('Should return 403 error', async () => {
        const {
          userService,
          workspaceService
        } = server.services();
        // create users
        const admin = await userService.signup({ email: 'admin@user.net' });
        const guest = await userService.signup({ email: 'guest@user.net' });
        // create tokens
        const tokens = await userService.createTokens(guest);
        // create workspace
        const { workspace } = await workspaceService.createWorkspace(admin, 'testWorkspace');
        await workspaceService.updateWorkspaceSettings(workspace.id, { canUsersInvite: false });

        // add guest to the workspace as a guest
        await workspaceService.addUserToWorkspace(workspace.id, guest.id, 'user');
        const response = await server.inject({
          method: 'POST',
          url: `/workspaces/${workspace.id}/invites`,
          headers: {
            'Authorization': `Bearer ${tokens.accessToken}`
          }
        });
        expect(response.statusCode).to.be.equal(403);
      });
    });
  });

  describe('GET /check/{code}', () => {
    describe('Invite code is expired', () => {
      it('should return status "expired"', async () => {
        const {
          userService,
          workspaceService
        } = server.services();
        // create users
        const admin = await userService.signup({ email: 'admin@user.net', name: 'n' });
        // create workspace
        const { workspace } = await workspaceService.createWorkspace(admin, 'testWorkspace');
        // create invite code
        const code = await workspaceService.inviteToWorkspace(workspace.id, admin.id);
        // make invite code is expired
        const now = new Date(Date.now() - 1000);
        await server.plugins['hapi-pg-promise'].db.none('UPDATE invites SET expired_at=$1 WHERE code=$2', [
          now,
          code
        ]);
        const response = await server.inject({
          method: 'GET',
          url: `/check/${code}`
        });
        expect(response.statusCode).to.be.equal(400);
      });
    });

    describe('Invite code is valid', () => {
      it('should return status "valid", info about the user who invited and info about workspace', async () => {
        const {
          userService,
          workspaceService
        } = server.services();
        // create users
        const admin = await userService.signup({ email: 'admin@user.net', name: 'n' });
        // create workspace
        const { workspace } = await workspaceService.createWorkspace(admin, 'testWorkspace');
        // create invite code
        const code = await workspaceService.inviteToWorkspace(workspace.id, admin.id, 'user@example.com');
        const response = await server.inject({
          method: 'GET',
          url: `/check/${code}`
        });
        expect(response.statusCode).to.be.equal(200);
        const body = JSON.parse(response.payload);
        expect(body.workspace).exists();
        expect(body.user).exists();
        expect(body.email).exists();
      });
    });
  });

  describe('POST /join/{code}', () => {
    describe('Try to join with an expired invite code', () => {
      it('Should return 400 Bad request', async () => {
        const {
          userService,
          workspaceService
        } = server.services();
        // create users
        const admin = await userService.signup({ email: 'admin@user.net' });
        const user = await userService.signup({ email: 'user@user.net' });
        // create tokens for user
        const tokens = await userService.createTokens(user);
        // create workspace
        const { workspace } = await workspaceService.createWorkspace(admin, 'testWorkspace');
        // create invite code
        const code = await workspaceService.inviteToWorkspace(workspace.id, admin.id);
        // make invite code is expired
        const now = new Date(Date.now() - 1000);
        await server.plugins['hapi-pg-promise'].db.none('UPDATE invites SET expired_at=$1 WHERE code=$2', [
          now,
          code
        ]);
        const response = await server.inject({
          method: 'POST',
          url: `/join/${code}`,
          headers: {
            'Authorization': `Bearer ${tokens.accessToken}`
          },
        });
        expect(response.statusCode).to.be.equal(400);
        const body = JSON.parse(response.payload);
        expect(body.message).equals('InvalidCode');
      });
    });
    describe('Try to join with a valid code', () => {
      it('should add user to the workspace and return workspace info', async () => {
        const {
          userService,
          workspaceService,
          workspaceDatabaseService: wdb
        } = server.services();
        // create users
        const admin = await userService.signup({ email: 'admin@user.net' });
        const user = await userService.signup({ email: 'user@user.net' });
        // create tokens for user
        const tokens = await userService.createTokens(user);
        // create workspace
        const { workspace } = await workspaceService.createWorkspace(admin, 'testWorkspace');
        // create invite code
        const code = await workspaceService.inviteToWorkspace(workspace.id, admin.id);
        const response = await server.inject({
          method: 'POST',
          url: `/join/${code}`,
          headers: {
            'Authorization': `Bearer ${tokens.accessToken}`
          },
        });
        expect(response.statusCode).to.be.equal(200);
        const workspaces = await wdb.getWorkspacesByUserId(user.id);
        expect(workspaces.length).equals(1);
        expect(workspaces[0].id).equals(workspace.id);
      });
    });
  });

  describe('POST /workspaces/{workspaceId}/invite/email', () => {
    describe('Try to send invite by email', () => {
      it('should send email, we have to check stubbed method', async () => {
        const { userService, workspaceService } = server.services();
        const user = await userService.signup({ email: 'admin@admin.ru' });
        const tokens = await userService.createTokens({ id: user.id });
        const { workspace } = await workspaceService.createWorkspace(user, 'testWorkspace');
        const email = 'invited_person@mail.ru';
        const response = await server.inject({
          method: 'POST',
          url: `/workspaces/${workspace.id}/invite/email`,
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`
          },
          payload: {
            emailList: [email],
          }
        });
        expect(response.statusCode).equals(200);
        expect(stubbedMethods.sendEmailWithInvite.calledOnce).true();
        expect(stubbedMethods.sendEmailWithInvite.firstCall.args[0][0]).equals(email);
      });
    });
  });

  describe('GET /workspaces/{workspaceId}/slack/connect', () => {
    describe('Try connect slack workspace to heyka workspace without persmissions', () => {
      it('Should return 401 status', async () => {
        const {
          userService,
          workspaceService
        } = server.services();
        const user = await userService.signup({ email: 'admin@admin.ru', auth: { slack: {} } });
        const anotherUser = await userService.signup({ email: 'another@admin.ru' , auth: { slack: {} } });
        const { workspace } = await workspaceService.createWorkspace(anotherUser, 'workspace');
        const tokens = await userService.createTokens(user);
        const response = await server.inject({
          method: 'GET',
          url: `/workspaces/${workspace.id}/slack/connect`,
          headers: { Authorization: `Bearer ${tokens.accessToken}` }
        });
        expect(response.statusCode).equals(401);
      });
    });
    describe('Try connect slack workspace to heyka workspace with persmissions', () => {
      it('Should return link to redirect user on slack', async () => {
        const {
          userService,
          workspaceService
        } = server.services();
        const user = await userService.signup({ email: 'admin@admin.ru', auth: { slack: {} } });
        const { workspace } = await workspaceService.createWorkspace(user, 'workspace');
        const tokens = await userService.createTokens(user);
        const response = await server.inject({
          method: 'GET',
          url: `/workspaces/${workspace.id}/slack/connect`,
          headers: { Authorization: `Bearer ${tokens.accessToken}` }
        });
        expect(response.statusCode).equals(200);
        expect(stubbedMethods.getConnectingSlackUrl.calledOnce).true();
      });
    });
  });

  describe('GET /workspaces/slack/connect/resume', () => {
    describe('User comes back from the slack with oauth code', () => {
      it('try to connect workspaces with valid data', async () => {
        const {
          userService,
          workspaceService,
          userDatabaseService
        } = server.services();
        const user = await userService.signup({ email: 'admin@admin.ru' });
        const { workspace } = await workspaceService.createWorkspace(user, 'testWorkspace');
        const slackState = uuid4();
        await userDatabaseService.saveSlackState(slackState, {
          workspaceId: workspace.id,
          userId: user.id
        });
        const response = await server.inject({
          method: 'GET',
          url: `/workspaces/slack/connect/resume?code=${uuid4()}&state=${slackState}`
        });
        expect(response.statusCode).equals(200);
      });
    });
  });

  describe('GET /workspaces/{workspaceId}/slack/detach', () => {
    it('Try to detach, slack field should be empty', async () => {
      const {
        userService,
        workspaceService,
        workspaceDatabaseService: wdb,
      } = server.services();
      const user = await userService.signup({ email: 'admin@admin.ru' });
      const { workspace } = await workspaceService.createWorkspace(user, 'testWorkspace');
      await wdb.updateWorkspace(workspace.id, {
        slack: { token: 'token', },
      });
      const tokens = await userService.createTokens(user);
      const response = await server.inject({
        method: 'GET',
        url: `/workspaces/${workspace.id}/slack/detach`,
        ...helpers.withAuthorization(tokens),
      });
      expect(response.statusCode).equals(200);
      const w = await wdb.getWorkspaceById(workspace.id);
      expect(w.slack).equals({});
    });
  });

  describe('POST /workspaces/{workspaceId}/slack/invite', () => {
    describe('Try to invite slack, but user hasnt permission to invite', () => {
      it('should return error with reason', async () => {
        const {
          userService,
          workspaceService
        } = server.services();
        const admin = await userService.signup({ email: 'admin@admin.ru' });
        const user = await userService.signup({ email: 'user@user.ru' });
        const tokens = await userService.createTokens(user);
        const { workspace } = await workspaceService.createWorkspace(admin, 'test');
        const response = await server.inject({
          method: 'POST',
          url: `/workspaces/${workspace.id}/slack/invite`,
          payload: {
            slackUserId: 'JUHSYND1'
          },
          headers: { Authorization: `Bearer ${tokens.accessToken}` }
        });
        expect(response.statusCode).equals(403);
        expect(response.payload).includes('NotAllowed');
      });
    });
    describe('Try to invite to workspace that isnt connected with slack', () => {
      it('should return error with the reason', async () => {
        const {
          userService,
          workspaceService
        } = server.services();
        const admin = await userService.signup({ email: 'admin@admin.ru', auth: { slack: {} }});
        const tokens = await userService.createTokens(admin);
        const { workspace } = await workspaceService.createWorkspace(admin, 'test');
        const response = await server.inject({
          method: 'POST',
          url: `/workspaces/${workspace.id}/slack/invite`,
          payload: {
            slackUserId: 'JUHSYND1'
          },
          headers: { Authorization: `Bearer ${tokens.accessToken}` }
        });
        expect(response.statusCode).equals(400);
        expect(response.payload).includes('SlackIsNotConnected');
      });
    });
    describe('Try to invite to workspace, everything is ok', () => {
      it('should return 200 status and call some slack-api methods', async () => {
        const {
          userService,
          workspaceService,
        } = server.services();
        const slackAccessToken = 'asdasd';
        const slackUserId = 'JUHSYND1';
        const senderSlackUserId = 'HJAK1S81';
        const db = server.plugins['hapi-pg-promise'].db;
        const admin = await userService.signup({
          email: 'admin@admin.ru',
          auth: { slack: { params: { user_id: senderSlackUserId }} }
        });
        const tokens = await userService.createTokens(admin);
        const { workspace } = await workspaceService.createWorkspace(admin, 'test');
        // emulate workspace connected to slack
        await db.none(
          'UPDATE workspaces SET slack=$1 WHERE id=$2',
          [{ access_token: slackAccessToken, ok: true }, workspace.id]
        );
        const response = await server.inject({
          method: 'POST',
          url: `/workspaces/${workspace.id}/slack/invite`,
          payload: {
            slackUserId
          },
          headers: { Authorization: `Bearer ${tokens.accessToken}` }
        });
        expect(response.statusCode).equals(200);
        expect(stubbedMethods.sendInviteToWorkspaceBySlack.calledOnce).true();
        const args = stubbedMethods.sendInviteToWorkspaceBySlack.args[0][0];
        expect(args[1]).equals(slackAccessToken);
        expect(args[2]).equals(slackUserId);
        expect(args[3]).equals(workspace.name);
      });
    });
  });

  describe('DELETE /invites/{inviteId}', () => {
    describe('Delete invite with revoking access', () => {
      it('Invite should be deleted, access should be revoked', async () => {
        const {
          userService,
          workspaceService,
          channelService,
          workspaceDatabaseService: wdb,
          inviteCodesDatabaseService: invdb,
        } = server.services();
        const user = await userService.signup({ name: 'user' });
        const { workspace } = await workspaceService.createWorkspace(user, 'test');
        const tokens = await userService.createTokens(user);
        const channel = await workspaceService.createChannel(workspace.id, user.id, {
          name: 'global'
        });
        const { code: inviteToken } = await channelService.getInviteChannelToken(channel.id, user.id);

        // sign up with this invite
        const response1 = await server.inject({
          method: 'POST',
          url: `/channels/join/${inviteToken}`,
          payload: {
            name: 'guest',
          }
        });
        expect(response1.statusCode).equals(200);

        // check that there are two users in workspace
        const members = await wdb.getWorkspaceMembers(workspace.id);
        expect(members).length(2);

        const invites = await invdb.getInvitesByChannel(channel.id);
        expect(invites).length(1);

        // delete invite with revoking access
        const response2 = await server.inject({
          method: 'DELETE',
          url: `/invites/${invites[0].id}?revokeAccess=true`,
          ...helpers.withAuthorization(tokens)
        });
        expect(response2.statusCode).equals(200);

        // check that invite doesnt exist
        const invitesAfterDelete = await invdb.getInvitesByChannel(channel.id);
        expect(invitesAfterDelete).length(0);

        // check that there is only one user in workspace
        const membersAfterDelete = await wdb.getWorkspaceMembers(workspace.id);
        expect(membersAfterDelete).length(1);
      });
    });
  });

  // Groups
  describe('Groups', () => {
    describe('POST /workspaces/${id}/groups : Create groups', () => {
      it('Create first group with name and a list of users, should return 200', async () => {
        const {
          userService,
          workspaceService,
        } = server.services();
        const user = await userService.signup({ name: 'user' });
        const user2 = await userService.signup({ name: 'user2' });
        const user3 = await userService.signup({ name: 'user3' });
        const { workspace } = await workspaceService.createWorkspace(user, 'test');
        await workspaceService.addUserToWorkspace(workspace.id, user2.id);
        await workspaceService.addUserToWorkspace(workspace.id, user3.id);

        const tokens = await userService.createTokens(user);

        const response = await server.inject({
          method: 'POST',
          url: `/workspaces/${workspace.id}/groups`,
          ...helpers.withAuthorization(tokens),
          payload: {
            name: 'Test',
            users: [user2.id, user3.id],
          }
        });
        expect(response.statusCode).equals(200);
        expect(response.result.id).exists();

        // check that there are two relations
        const db = server.plugins['hapi-pg-promise'].db;
        const relations = await db.any('SELECT * FROM groups_members WHERE group_id=$1', [response.result.id]);
        expect(relations).array().length(2);
      });
    });
    describe('POST /groups/${id}/members : Add new users to group', () => {
      it('Create new empty group, add two users, check that users are added', async () => {
        const {
          userService,
          workspaceService,
        } = server.services();
        const user = await userService.signup({ name: 'user' });
        const user2 = await userService.signup({ name: 'user2' });
        const user3 = await userService.signup({ name: 'user3' });
        const { workspace } = await workspaceService.createWorkspace(user, 'test');
        await workspaceService.addUserToWorkspace(workspace.id, user2.id);
        await workspaceService.addUserToWorkspace(workspace.id, user3.id);

        const tokens = await userService.createTokens(user);

        const response = await server.inject({
          method: 'POST',
          url: `/workspaces/${workspace.id}/groups`,
          ...helpers.withAuthorization(tokens),
          payload: {
            name: 'Test',
            users: [],
          }
        });
        expect(response.statusCode).equals(200);
        expect(response.result.id).exists();

        // add two users to the group
        const response2 = await server.inject({
          method: 'POST',
          url: `/groups/${response.result.id}/members`,
          ...helpers.withAuthorization(tokens),
          payload: {
            users: [user2.id, user3.id],
          }
        });
        expect(response2.statusCode).equals(200);

        // check that there are two relations
        const db = server.plugins['hapi-pg-promise'].db;
        const relations = await db.any('SELECT * FROM groups_members WHERE group_id=$1', [response.result.id]);
        expect(relations).array().length(2);
      });
      it('Add user that already added to the group', async () => {
        const {
          userService,
          workspaceService,
        } = server.services();
        const user = await userService.signup({ name: 'user' });
        const user2 = await userService.signup({ name: 'user2' });
        const user3 = await userService.signup({ name: 'user3' });
        const { workspace } = await workspaceService.createWorkspace(user, 'test');
        await workspaceService.addUserToWorkspace(workspace.id, user2.id);
        await workspaceService.addUserToWorkspace(workspace.id, user3.id);

        const tokens = await userService.createTokens(user);

        const response = await server.inject({
          method: 'POST',
          url: `/workspaces/${workspace.id}/groups`,
          ...helpers.withAuthorization(tokens),
          payload: {
            name: 'Test',
            users: [user2.id, user3.id],
          }
        });
        expect(response.statusCode).equals(200);
        expect(response.result.id).exists();

        // added already existing user
        const response2 = await server.inject({
          method: 'POST',
          url: `/groups/${response.result.id}/members`,
          ...helpers.withAuthorization(tokens),
          payload: {
            users: [user2.id],
          }
        });
        expect(response2.statusCode).equals(200);

        // check that there are two relations
        const db = server.plugins['hapi-pg-promise'].db;
        const relations = await db.any('SELECT * FROM groups_members WHERE group_id=$1', [response.result.id]);
        expect(relations).array().length(2);
      });
    });
    describe('DELETE /groups/${id}/members : Remove users from group', () => {
      it('Create group with two users, delete one from them, check', async () => {
        const {
          userService,
          workspaceService,
        } = server.services();
        const user = await userService.signup({ name: 'user' });
        const user2 = await userService.signup({ name: 'user2' });
        const user3 = await userService.signup({ name: 'user3' });
        const { workspace } = await workspaceService.createWorkspace(user, 'test');
        await workspaceService.addUserToWorkspace(workspace.id, user2.id);
        await workspaceService.addUserToWorkspace(workspace.id, user3.id);

        const tokens = await userService.createTokens(user);

        const response = await server.inject({
          method: 'POST',
          url: `/workspaces/${workspace.id}/groups`,
          ...helpers.withAuthorization(tokens),
          payload: {
            name: 'Test',
            users: [user2.id, user3.id],
          }
        });
        expect(response.statusCode).equals(200);
        expect(response.result.id).exists();

        // delete one of them from list
        const response2 = await server.inject({
          method: 'DELETE',
          url: `/groups/${response.result.id}/members`,
          ...helpers.withAuthorization(tokens),
          payload: {
            users: [user2.id],
          }
        });
        expect(response2.statusCode).equals(200);

        // check that there is single relation
        const db = server.plugins['hapi-pg-promise'].db;
        const relations = await db.any('SELECT * FROM groups_members WHERE group_id=$1', [response.result.id]);
        expect(relations).array().length(1);
        expect(relations[0].user_id).equals(user3.id);
      });
      it('Delete member that doesnt exists in this group', async () => {
        const {
          userService,
          workspaceService,
        } = server.services();
        const user = await userService.signup({ name: 'user' });
        const user2 = await userService.signup({ name: 'user2' });
        const user3 = await userService.signup({ name: 'user3' });
        const { workspace } = await workspaceService.createWorkspace(user, 'test');
        await workspaceService.addUserToWorkspace(workspace.id, user2.id);
        await workspaceService.addUserToWorkspace(workspace.id, user3.id);

        const tokens = await userService.createTokens(user);

        const response = await server.inject({
          method: 'POST',
          url: `/workspaces/${workspace.id}/groups`,
          ...helpers.withAuthorization(tokens),
          payload: {
            name: 'Test',
            users: [user2.id],
          }
        });
        expect(response.statusCode).equals(200);
        expect(response.result.id).exists();

        // delete one of them from list
        const response2 = await server.inject({
          method: 'DELETE',
          url: `/groups/${response.result.id}/members`,
          ...helpers.withAuthorization(tokens),
          payload: {
            users: [user3.id],
          }
        });
        expect(response2.statusCode).equals(200);

        // check that there is single relation
        const db = server.plugins['hapi-pg-promise'].db;
        const relations = await db.any('SELECT * FROM groups_members WHERE group_id=$1', [response.result.id]);
        expect(relations).array().length(1);
        expect(relations[0].user_id).equals(user2.id);
      });
    });
    describe('GET /workspaces/${id}/groups : Get list of groups', () => {
      it('Get list of groups, check that everything is ok', async () => {
        const {
          userService,
          workspaceService,
        } = server.services();
        const user = await userService.signup({ name: 'user' });
        const user2 = await userService.signup({ name: 'user2' });
        const user3 = await userService.signup({ name: 'user3' });
        const { workspace } = await workspaceService.createWorkspace(user, 'test');
        await workspaceService.addUserToWorkspace(workspace.id, user2.id);
        await workspaceService.addUserToWorkspace(workspace.id, user3.id);

        const tokens = await userService.createTokens(user);

        const response = await server.inject({
          method: 'POST',
          url: `/workspaces/${workspace.id}/groups`,
          ...helpers.withAuthorization(tokens),
          payload: {
            name: 'Test',
            users: [user2.id, user3.id],
          }
        });
        expect(response.statusCode).equals(200);
        expect(response.result.id).exists();

        // get the list of groups in that workpsace
        const response2 = await server.inject({
          method: 'GET',
          url: `/workspaces/${workspace.id}/groups`,
          ...helpers.withAuthorization(tokens),
        });
        expect(response2.statusCode).equals(200);
        expect(response2.result).array().length(1);
        expect(response2.result[0].id).equals(response.result.id);
        expect(response2.result[0].name).exists();
        expect(response2.result[0].membersCount).equals(2);
      });
      it('Get list of groups, check that empty group there are', async () => {
        const {
          userService,
          workspaceService,
        } = server.services();
        const user = await userService.signup({ name: 'user' });
        const user2 = await userService.signup({ name: 'user2' });
        const user3 = await userService.signup({ name: 'user3' });
        const { workspace } = await workspaceService.createWorkspace(user, 'test');
        await workspaceService.addUserToWorkspace(workspace.id, user2.id);
        await workspaceService.addUserToWorkspace(workspace.id, user3.id);

        const tokens = await userService.createTokens(user);

        const response = await server.inject({
          method: 'POST',
          url: `/workspaces/${workspace.id}/groups`,
          ...helpers.withAuthorization(tokens),
          payload: {
            name: 'Test',
            users: [],
          }
        });
        expect(response.statusCode).equals(200);
        expect(response.result.id).exists();

        // get the list of groups in that workpsace
        const response2 = await server.inject({
          method: 'GET',
          url: `/workspaces/${workspace.id}/groups`,
          ...helpers.withAuthorization(tokens),
        });
        expect(response2.statusCode).equals(200);
        expect(response2.result).array().length(1);
        expect(response2.result[0].id).equals(response.result.id);
        expect(response2.result[0].name).exists();
        expect(response2.result[0].membersCount).equals(0);
      });
    });
    describe('GET /groups/${id}/members : Get list of users in the group', () => {
      it('Get list of users', async () => {
        const {
          userService,
          workspaceService,
        } = server.services();
        const user = await userService.signup({ name: 'user' });
        const user2 = await userService.signup({ name: 'user2' });
        const user3 = await userService.signup({ name: 'user3' });
        const { workspace } = await workspaceService.createWorkspace(user, 'test');
        await workspaceService.addUserToWorkspace(workspace.id, user2.id);
        await workspaceService.addUserToWorkspace(workspace.id, user3.id);

        const tokens = await userService.createTokens(user);

        const response = await server.inject({
          method: 'POST',
          url: `/workspaces/${workspace.id}/groups`,
          ...helpers.withAuthorization(tokens),
          payload: {
            name: 'Test',
            users: [user.id, user2.id, user3.id],
          }
        });
        expect(response.statusCode).equals(200);
        expect(response.result.id).exists();

        // check that there are two relations
        const response2 = await server.inject({
          method: 'GET',
          url: `/groups/${response.result.id}/members`,
          ...helpers.withAuthorization(tokens),
        });
        expect(response2.statusCode).equals(200);
        expect(response2.result).array().length(3);
        expect(response2.result.find(u => u.id === user2.id)).exists();
        expect(response2.result.find(u => u.id === user3.id)).exists();
        const user1InArray = response2.result.find(u => u.id === user.id);
        expect(user1InArray.latestActivityAt).exists();
      });
    });
    describe('POST /groups/${id} : Edit the group', () => {
      it('Edit name of group', async () => {
        const {
          userService,
          workspaceService,
        } = server.services();
        const user = await userService.signup({ name: 'user' });
        const user2 = await userService.signup({ name: 'user2' });
        const user3 = await userService.signup({ name: 'user3' });
        const { workspace } = await workspaceService.createWorkspace(user, 'test');
        await workspaceService.addUserToWorkspace(workspace.id, user2.id);
        await workspaceService.addUserToWorkspace(workspace.id, user3.id);

        const tokens = await userService.createTokens(user);

        const response = await server.inject({
          method: 'POST',
          url: `/workspaces/${workspace.id}/groups`,
          ...helpers.withAuthorization(tokens),
          payload: {
            name: 'Test',
            users: [user2.id, user3.id],
          }
        });
        expect(response.statusCode).equals(200);
        expect(response.result.id).exists();

        // check that there are two relations
        const response2 = await server.inject({
          method: 'POST',
          url: `/groups/${response.result.id}`,
          ...helpers.withAuthorization(tokens),
          payload: {
            name: 'TestEdited'
          }
        });
        expect(response2.statusCode).equals(200);

        // check that name is changed
        const db = server.plugins['hapi-pg-promise'].db;
        const object = await db.one('SELECT * FROM groups WHERE id=$1', [response.result.id]);
        expect(object).exists();
      });
    });
    describe('DELETE /groups/${id} : Delete the group', () => {
      it('Delete group', async () => {
        const {
          userService,
          workspaceService,
        } = server.services();
        const user = await userService.signup({ name: 'user' });
        const user2 = await userService.signup({ name: 'user2' });
        const user3 = await userService.signup({ name: 'user3' });
        const { workspace } = await workspaceService.createWorkspace(user, 'test');
        await workspaceService.addUserToWorkspace(workspace.id, user2.id);
        await workspaceService.addUserToWorkspace(workspace.id, user3.id);

        const tokens = await userService.createTokens(user);

        const response = await server.inject({
          method: 'POST',
          url: `/workspaces/${workspace.id}/groups`,
          ...helpers.withAuthorization(tokens),
          payload: {
            name: 'Test',
            users: [user2.id, user3.id],
          }
        });
        expect(response.statusCode).equals(200);
        expect(response.result.id).exists();

        // check that group exists
        const db = server.plugins['hapi-pg-promise'].db;
        const object = await db.one('SELECT * FROM groups WHERE id=$1', [response.result.id]);
        expect(object).exists();

        // delete group
        const response2 = await server.inject({
          method: 'DELETE',
          url: `/groups/${response.result.id}`,
          ...helpers.withAuthorization(tokens),
        });
        expect(response2.statusCode).equals(200);

        // check that group doesnt exists
        const object2 = await db.oneOrNone('SELECT * FROM groups WHERE id=$1', [response.result.id]);
        expect(object2).not.exists();
      });
    });
  });

  /**
   * Email verification functionality
   */
  describe('POST /vefiry/{code}', () => {
    describe('Try to verify not valid verification code', () => {
      it('should return fail status, reason should be "invalid code"', async () => {
        const token = jwt.sign({
          userId: uuid4(),
          email: 'random@email.ru',
        }, config.jwtSecret);
        const response = await server.inject({
          method: 'GET',
          url: `/verify/${token}`
        });
        expect(response.statusCode).equals(400);
        const payload = JSON.parse(response.payload);
        expect(payload.message).equals('Verification code is not valid');
      });
    });
    describe('Try to verify an expired verification code', () => {
      it('should return fail status, reason should be "invalid code"', async () => {
        const { userService } = server.services();
        await userService.signup({ email: 'admin@admin.ru' });
        const token = stubbedMethods.sendEmail.firstCall.args[0][1];
        MockDate.set(Date.now() + 36000000000);
        const response = await server.inject({
          method: 'GET',
          url: `/verify/${token}`
        });
        MockDate.reset();
        expect(response.statusCode).equals(400);
        const payload = JSON.parse(response.payload);
        expect(payload.message).equals('Verification code is not valid');
      });
    });
    describe('Try to verify valid verification code', () => {
      it('should set "email_verified" true', async () => {
        const { userService } = server.services();
        const user = await userService.signup({ name: 'name', email: 'admin@admin.ru' });
        const token = stubbedMethods.sendEmail.firstCall.args[0][1];
        const response = await server.inject({
          method: 'GET',
          url: `/verify/${token}`
        });
        expect(response.statusCode).equals(200);
        // check is email verified
        const userUpdated = await userService.findById(user.id);
        expect(userUpdated.is_email_verified).true();
      });
      it('change email if it is needed', async () => {
        const { userService } = server.services();
        const user = await userService.signup({ name: 'name', email: 'admin@admin.ru' });
        await userService.updateProfile(user.id, { email: 'new@admin.ru' });
        const token = stubbedMethods.sendEmail.secondCall.args[0][1];
        const response = await server.inject({
          method: 'GET',
          url: `/verify/${token}`
        });
        expect(response.statusCode).equals(200);
        // check is email verified
        const userUpdated = await userService.findById(user.id);
        expect(userUpdated.is_email_verified).true();
        expect(userUpdated.email).equals('new@admin.ru');
      });
    });
  });

  /**
   * authentication link functionality
   */
  describe('POST /auth-link', () => {
    describe('creates auth link', () => {
      it('should create auth link in the database', async () => {
        const { userService } = server.services();
        const user = await userService.signup({ email: 'user@user.ru' });
        const tokens = await userService.createTokens(user);
        const response = await server.inject({
          method: 'POST',
          url: '/create-auth-link',
          headers: { Authorization: `Bearer ${tokens.accessToken}` }
        });
        expect(response.statusCode).equals(200);
        const payload = JSON.parse(response.payload);
        const db = server.plugins['hapi-pg-promise'].db;
        const authLink = await db.one('SELECT * FROM auth_links WHERE user_id=$1', [user.id]);
        expect(payload.code).equals(serviceHelpers.codeConvertToUrl(authLink.id, authLink.code));
      });
    });
  });
  describe('POST /signin/link/${fullCode}', () => {
    describe('try to signin with an expired code', () => {
      it('should return badRequest error', async () => {
        const { userService } = server.services();
        const db = server.plugins['hapi-pg-promise'].db;
        const user = await userService.signup({ email: 'user@user.ru' });
        const code = await userService.createAuthLink(user.id);
        await db.none('UPDATE auth_links SET expired_at=$1 WHERE user_id=$2', [
          new Date(Date.now() - 1),
          user.id
        ]);
        const response = await server.inject({
          method: 'POST',
          url: `/signin/link/${code}`
        });
        expect(response.statusCode).equals(400);
      });
    });
    describe('try to signin with a valid code', () => {
      it('should return auth credentials as a normal pacan', async () => {
        const { userService } = server.services();
        const user = await userService.signup({ email: 'user@user.ru' });
        const code = await userService.createAuthLink(user.id);
        const response = await server.inject({
          method: 'POST',
          url: `/signin/link/${code}`
        });
        expect(response.statusCode).equals(200);
        const payload = JSON.parse(response.payload);
        expect(payload.accessToken).exists();
        expect(payload.refreshToken).exists();
      });
    });
  });

  /**
   * Usage counter, calls counter
   */
  describe('Check channel usage counter & calls counter between users', () => {
    it('Select channel, usage counter should increase', async () => {
      const {
        userService,
        workspaceService,
        connectionService
      } = server.services();
      const user = await userService.signup({ email: 'test@user.ru' });
      const { workspace } = await workspaceService.createWorkspace(user, 'test');
      const channel1 = await workspaceService.createChannel(workspace.id, user.id, {
        name: 'test',
        isPrivate: false
      });
      const channel2 = await workspaceService.createChannel(workspace.id, user.id, {
        name: 'test2',
        isPrivate: false
      });
      const tokens = await userService.createTokens(user);
      const conn = generateFakeConnection(user.id, workspace.id);
      await connectionService.setConnectionObject(conn);
      const response = await server.inject({
        method: 'POST',
        url: `/channels/${channel1.id}/select?socketId=${conn.connectionId}`,
        ...helpers.withAuthorization(tokens),
        payload: helpers.defaultUserState()
      });
      expect(response.statusCode).equals(200);
      const response2 = await server.inject({
        method: 'POST',
        url: `/channels/${channel1.id}/unselect?socketId=${conn.connectionId}`,
        ...helpers.withAuthorization(tokens),
      });
      const response3 = await server.inject({
        method: 'POST',
        url: `/channels/${channel1.id}/select?socketId=${conn.connectionId}`,
        ...helpers.withAuthorization(tokens),
        payload: helpers.defaultUserState()
      });
      expect(response.statusCode).equals(200);
      expect(response2.statusCode).equals(200);
      expect(response3.statusCode).equals(200);
      await helpers.skipSomeTime(10);

      const workspaceState = await workspaceService.getWorkspaceStateForUser(workspace.id, user.id);
      expect(workspaceState.channels.find(ch => ch.id===channel1.id).usage_count).equals(2);
      expect(workspaceState.channels.find(ch => ch.id===channel1.id).latest_usage).exists();
      expect(workspaceState.channels.find(ch => ch.id===channel2.id).usage_count).equals(0);
    });
    it('Make private call, calls counter should increase', async () => {
      const {
        userService,
        workspaceService
      } = server.services();
      const [
        user1,
        user2,
        user3
      ] = await Promise.all([
        userService.signup({ email: 'user1@example.com' }),
        userService.signup({ email: 'user2@example.com' }),
        userService.signup({ email: 'user3@example.com' }),
      ]);
      const { workspace } = await workspaceService.createNewWorkspace(user1.id, { name: 'test' });
      await Promise.all([
        workspaceService.addUserToWorkspace(workspace.id, user2.id),
        workspaceService.addUserToWorkspace(workspace.id, user3.id),
      ]);
      const tokens = await userService.createTokens(user1);
      const startTalkResponse1 = await server.inject({
        method: 'POST',
        url: `/workspaces/${workspace.id}/private-talk`,
        ...helpers.withAuthorization(tokens),
        payload: {
          users: [user2.id]
        }
      });
      expect(startTalkResponse1.statusCode).equals(200);
      await helpers.skipSomeTime(10);

      const workspaceState = await workspaceService.getWorkspaceStateForUser(workspace.id, user1.id);
      expect(workspaceState.users.find(u => u.id===user2.id).calls_count).equals(1);
      expect(workspaceState.users.find(u => u.id===user2.id).latest_call).exists();
      expect(workspaceState.users.find(u => u.id===user3.id).calls_count).null();
    });
  });

  /**
   * Testing mobile pushes
   */
  describe('Checking mobile pushes', () => {
    describe('Adding/deleting mobile pushes', () => {
      it('Adding device token', async () => {
        const {
          userService,
          userDatabaseService: udb,
        } = server.services();
        const user = await userService.signup({ email: 'test@user.ru' });
        const tokens = await userService.createTokens(user);
        const response = await server.inject({
          method: 'POST',
          url: `/add-device-token`,
          ...helpers.withAuthorization(tokens),
          payload: {
            deviceToken: 'unique-token',
            platform: 'iOS',
          }
        });
        const response2 = await server.inject({
          method: 'POST',
          url: `/add-device-token`,
          ...helpers.withAuthorization(tokens),
          payload: {
            deviceToken: 'unique-token',
            platform: 'iOS',
          }
        });
        const response3 = await server.inject({
          method: 'POST',
          url: `/add-device-token`,
          ...helpers.withAuthorization(tokens),
          payload: {
            deviceToken: 'unique-token-2',
            platform: 'iOS',
          }
        });
        expect(response.statusCode).equals(200);
        expect(response2.statusCode).equals(200);
        expect(response3.statusCode).equals(200);
        const userAfterUpdate = await udb.findById(user.id);
        expect(userAfterUpdate.device_tokens.length).equals(2);
        expect(userAfterUpdate.device_tokens[0]).includes('unique-token');

      });
      it('Deleting device token', async () => {
        const {
          userService,
          userDatabaseService: udb,
        } = server.services();
        const user = await userService.signup({ email: 'test@user.ru' });
        const tokens = await userService.createTokens(user);
        const response = await server.inject({
          method: 'POST',
          url: `/add-device-token`,
          ...helpers.withAuthorization(tokens),
          payload: {
            deviceToken: 'unique-token',
            platform: 'iOS',
          }
        });
        const response2 = await server.inject({
          method: 'POST',
          url: `/delete-device-token`,
          ...helpers.withAuthorization(tokens),
          payload: {
            deviceToken: 'unique-token',
          }
        });
        expect(response.statusCode).equals(200);
        expect(response2.statusCode).equals(200);
        const userAfterUpdate = await udb.findById(user.id);
        expect(userAfterUpdate.device_tokens.length).equals(0);
        expect(Object.values(userAfterUpdate.platform_endpoints).length).equals(0);
      });
      it('Send invite, check that push notification is sent', async () => {
        const {
          userService,
          workspaceService,
        } = server.services();
        const user = await userService.signup({ email: 'test@user.ru' });
        const user2 = await userService.signup({ email: 'test2@user.ru' });
        const tokens = await userService.createTokens(user);
        const tokens2 = await userService.createTokens(user2);
        const { workspace } = await workspaceService.createNewWorkspace(user.id, { name: 'test' });
        await workspaceService.addUserToWorkspace(workspace.id, user2.id);
        const channel = await workspaceService.createChannel(workspace.id, user.id, { name: 'test' });
        const response = await server.inject({
          method: 'POST',
          url: `/add-device-token`,
          ...helpers.withAuthorization(tokens),
          payload: {
            deviceToken: 'unique-token',
            platform: 'iOS',
          }
        });
        const response2 = await server.inject({
          method: 'POST',
          url: `/send-invite`,
          ...helpers.withAuthorization(tokens2),
          payload: {
            userId: user.id,
            message: { data: 'any data' },
            channelId: channel.id,
            workspaceId: workspace.id,
          }
        });
        expect(response.statusCode).equals(200);
        expect(response2.statusCode).equals(200);
        expect(stubbedMethods.sendPushNotificationToDevice.callCount).equals(1);
        expect(stubbedMethods.sendPushNotificationToDevice.args[0][0]).equals('iOS@unique-token');
      });
      it('Send batch of invites, check that push notifications is sent', async () => {
        const {
          userService,
          workspaceService,
        } = server.services();
        const user = await userService.signup({ email: 'test@user.ru' });
        const user2 = await userService.signup({ email: 'test2@user.ru' });
        const user3 = await userService.signup({ email: 'test3@user.ru' });
        const tokens = await userService.createTokens(user);
        const tokens2 = await userService.createTokens(user2);
        const { workspace } = await workspaceService.createNewWorkspace(user.id, { name: 'test' });
        await workspaceService.addUserToWorkspace(workspace.id, user2.id);
        await workspaceService.addUserToWorkspace(workspace.id, user3.id);
        const channel = await workspaceService.createChannel(workspace.id, user.id, { name: 'test' });
        const response = await server.inject({
          method: 'POST',
          url: `/add-device-token`,
          ...helpers.withAuthorization(tokens),
          payload: {
            deviceToken: 'unique-token',
            platform: 'iOS',
          }
        });
        const response2 = await server.inject({
          method: 'POST',
          url: `/send-invites`,
          ...helpers.withAuthorization(tokens2),
          payload: {
            users: [ user.id, user2.id, user3.id, user3.id ],
            message: { data: 'any data' },
            channelId: channel.id,
            workspaceId: workspace.id,
          }
        });
        expect(response.statusCode).equals(200);
        expect(response2.statusCode).equals(200);
        expect(stubbedMethods.sendPushNotificationToDevice.callCount).equals(1);
        expect(stubbedMethods.sendPushNotificationToDevice.args[0][0]).equals('iOS@unique-token');
        const messages = response2.result.invites.filter(i => i.invite);
        expect(messages.length).equals(2);
      });
      // it('Send invite, check that push notification is sent and disabled tokens is deleted', async () => {
      //   const {
      //     userService,
      //     userDatabaseService: udb,
      //   } = server.services();
      //   const user = await userService.signup({ email: 'test@user.ru' });
      //   const tokens = await userService.createTokens(user);
      //   const response = await server.inject({
      //     method: 'POST',
      //     url: `/add-device-token`,
      //     ...helpers.withAuthorization(tokens),
      //     payload: {
      //       deviceToken: 'unique-token',
      //       platform: 'iOS',
      //     }
      //   });
      //   stubbedMethods.getDisabledEndpoints.returns(['unique-token']);
      //   const response2 = await server.inject({
      //     method: 'POST',
      //     url: `/add-device-token`,
      //     ...helpers.withAuthorization(tokens),
      //     payload: {
      //       deviceToken: 'unique-token2',
      //       platform: 'iOS',
      //     }
      //   });
      //   expect(response.statusCode).equals(200);
      //   expect(response2.statusCode).equals(200);
      //   const userAfterAPICalls = await udb.findById(user.id);
      //   expect(userAfterAPICalls.device_tokens.length).equals(1);
      // });
    });
  });
});
