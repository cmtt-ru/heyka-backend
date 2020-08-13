'use strict';

const Lab = require('@hapi/lab');
const { describe, it, before, beforeEach } = exports.lab = Lab.script();
const createServer = require('../server');
const { expect } = require('@hapi/code');
const uuid4 = require('uuid/v4');
const crypto = require('crypto-promise');
const serviceHelpers = require('../lib/services/helpers');
const { methods: stubbedMethods } = require('./stub_external');
const helpers = require('./helpers');
const IMAGE_EXAMPLE = Buffer.from('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAACXBIWXMAA'
  + 'AGKAAABigEzlzBYAAAAB3RJTUUH5AQXDwEOjLBhqQAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVBkLmUHAAAALElEQVQI'
  + '1yXHsRHAQAzDMEbn/Sf0KBbvi6DDt7tt1STT9u5UIID6f4AkMwM8YOUadrVD1GUAAAAASUVORK5CYII=', 'base64');
const errorMessages = require('../lib/error_messages');
const generateFakeConnection = (userId, workspaceId) => ({
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

  beforeEach(async () => {
    const db = server.plugins['hapi-pg-promise'].db;
    await server.redis.client.flushdb();
    await db.query('DELETE FROM verification_codes');
    await db.query('DELETE FROM auth_links');
    await db.query('DELETE FROM users');
    await db.query('DELETE FROM sessions');
    await db.query('DELETE FROM channels');
    await db.query('DELETE FROM invites');
    await db.query('DELETE FROM workspaces');
    // clear all stubbed methods
    Object.values(stubbedMethods).forEach(func => func.reset());
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
        expect(stubbedMethods.sendEmail.args[0][0][0]).equals(email);
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
      it('Should return new tokens and delete old ones', async () => {
        const { userService } = server.services();
        const user = await userService.signup({ email: 'funny@chel.ru' });
        const tokens = await userService.createTokens(user, 10000, 10000);
        const response = await server.inject({
          method: 'POST',
          url: '/refresh-token',
          payload: { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken }
        });
        expect(response.statusCode).to.be.equal(200);
        const payload = JSON.parse(response.payload);
        expect(payload).includes('accessToken');
        expect(payload).includes('refreshToken');
        expect(await userService.findAccessToken(tokens.accessToken)).to.be.null();
        expect(await userService.findRefreshToken(tokens.refreshToken)).to.be.null();
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
    describe('Get user without email', () => {
      describe('should work fine, 200 status', async () => {
        it('should return current authenticated user', async () => {
          const {
            userService,
            userDatabaseService: udb,
          } = server.services();
          const userInfo = {
            name: 'test',
            email: 'testEmail@mail.ru'
          };
          const user = await userService.signup(userInfo);
          await udb.updateUser(user.id, {
            email: null,
            auth: {
              facebook: {
                id: 'facebook-id'
              }
            }
          });
          const tokens = await userService.createTokens(user);
          const response = await server.inject({
            method: 'GET',
            url: '/me',
            ...helpers.withAuthorization(tokens)
          });
          expect(response.statusCode).equals(200);
          const payload = JSON.parse(response.payload);
          expect(payload.id).equals(user.id);
          expect(payload.socialAuth.facebook).exists();
        });
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
        expect(result.image).exists();
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

  describe('GET /detach-account/{service}', () => {
    describe('Detach external service that was attached', () => {
      it ('Should return OK', async () => {
        const {
          userService,
          userDatabaseService: udb,
        } = server.services();
        const userInfo = {
          name: 'test',
          email: 'testEmail@mail.ru'
        };
        const user = await userService.signup(userInfo);
        await udb.updateUser(user.id, {
          auth: {
            facebook: {
              id: 'facebook-id'
            },
            slack: {
              id: 'slack-id'
            }
          }
        });
        const tokens = await userService.createTokens(user);
        const response = await server.inject({
          method: 'GET',
          url: `/detach-account/facebook`,
          ...helpers.withAuthorization(tokens)
        });
        expect(response.statusCode).equals(200);
        expect(response.payload).equals('OK');
        const userAfterUpdate = await udb.findById(user.id);
        expect(userAfterUpdate.auth.facebook).not.exists();
        expect(userAfterUpdate.auth.slack).exists();
      });
    });
    describe('Detach account that was not attached', () => {
      it ('Should return 400', async () => {
        const {
          userService,
          userDatabaseService: udb,
        } = server.services();
        const userInfo = {
          name: 'test',
          email: 'testEmail@mail.ru'
        };
        const user = await userService.signup(userInfo);
        await udb.updateUser(user.id, {
          auth: {
            facebook: {
              id: 'facebook-id'
            },
            slack: {
              id: 'slack-id'
            }
          }
        });
        const tokens = await userService.createTokens(user);
        const response = await server.inject({
          method: 'GET',
          url: `/detach-account/google`,
          ...helpers.withAuthorization(tokens)
        });
        expect(response.statusCode).equals(400);
      });
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

  describe('GET /workspaces/{workspaceId}', () => {
    describe('request the state of the workspace', () => {
      it('should return workspace state, array of users and channels', async () => {
        const { userService, workspaceService } = server.services();
        const user = await userService.signup({ email: 'user@heyka.com', name: 'n' });
        const user2 = await userService.signup({ email: 'user2@heyka.com', name: 'n2' });
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
    describe('User is on active conversation, he tries to leave the workspace', () => {
      it('should response with error (cant leave the workspace when is on active conv.', async () => {
        const {
          userService,
          workspaceService,
          connectionService
        } = server.services();
        const admin = await userService.signup({ email: 'admin@heyka.ru'});
        const user = await userService.signup({ email: 'user@heyka.ru' });
        const { workspace } = await workspaceService.createWorkspace(admin, 'test');
        await workspaceService.addUserToWorkspace(workspace.id, user.id);
        const channel = await workspaceService.createChannel(workspace.id, admin.id, {
          name: 'test',
          isPrivate: false
        });
        const tokens = await userService.createTokens(user);

        // add connection for user
        const conn = generateFakeConnection(user.id, workspace.id);
        await connectionService.setConnectionObject(conn);

        // user select the channel
        const selectResponse = await server.inject({
          method: 'POST',
          url: `/channels/${channel.id}/select?socketId=${conn.connectionId}`,
          payload: helpers.defaultUserState(),
          ...helpers.withAuthorization(tokens)
        });
        expect(selectResponse.statusCode).equals(200);
        // try to leave the workspace
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
    describe('User tries to leave channel what he is on active conversation in that channel', () => {
      it('should response with error', async () => {
        const {
          userService,
          workspaceService,
          connectionService
        } = server.services();
        const user = await userService.signup({ email: 'user@admin.ru' });
        const tokens = await userService.createTokens(user);
        const { workspace } = await workspaceService.createWorkspace(user, 'test');
        const channel = await workspaceService.createChannel(workspace.id, user.id, {
          name: 'test',
          isPrivate: false
        });
        const conn = generateFakeConnection(user.id, workspace.id);
        await connectionService.setConnectionObject(conn);
        const selectResponse = await server.inject({
          method: 'POST',
          url: `/channels/${channel.id}/select?socketId=${conn.connectionId}`,
          payload: helpers.defaultUserState(),
          ...helpers.withAuthorization(tokens)
        });
        expect(selectResponse.statusCode).equals(200);
        const response = await server.inject({
          method: 'POST',
          url: `/channels/${channel.id}/leave`,
          ...helpers.withAuthorization(tokens)
        });
        expect(response.statusCode).equals(403);
      });
    });
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
        expect(body.code).match(/^[0-9a-f]{82}$/i);
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
        await server.plugins['hapi-pg-promise'].db.none('UPDATE invites SET expired_at=$1 WHERE id=$2', [
          now,
          code.code.id
        ]);
        const response = await server.inject({
          method: 'GET',
          url: `/check/${code.fullCode}`
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
        const code = await workspaceService.inviteToWorkspace(workspace.id, admin.id);
        const response = await server.inject({
          method: 'GET',
          url: `/check/${code.fullCode}`
        });
        expect(response.statusCode).to.be.equal(200);
        const body = JSON.parse(response.payload);
        expect(body.workspace).exists();
        expect(body.user).exists();
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
        await server.plugins['hapi-pg-promise'].db.none('UPDATE invites SET expired_at=$1 WHERE id=$2', [
          now,
          code.code.id
        ]);
        const response = await server.inject({
          method: 'POST',
          url: `/join/${code.fullCode}`,
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
          url: `/join/${code.fullCode}`,
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
            email
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

  describe('POST /workspaces/{workspaceId}/invite/slack', () => {
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
          url: `/workspaces/${workspace.id}/invite/slack`,
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
          url: `/workspaces/${workspace.id}/invite/slack`,
          payload: {
            slackUserId: 'JUHSYND1'
          },
          headers: { Authorization: `Bearer ${tokens.accessToken}` }
        });
        expect(response.statusCode).equals(400);
        expect(response.payload).includes('SlackIsNotConnected');
      });
    });
    describe('Try to invite to workspace, but user is not associated with slack', () => {
      it('should return error with the reason', async () => {
        const {
          userService,
          workspaceService,
        } = server.services();
        const db = server.plugins['hapi-pg-promise'].db;
        const admin = await userService.signup({ email: 'admin@admin.ru' });
        const tokens = await userService.createTokens(admin);
        const { workspace } = await workspaceService.createWorkspace(admin, 'test');
        // emulate workspace connected to slack
        await db.none(
          'UPDATE workspaces SET slack=$1 WHERE id=$2',
          [{ accessToken: 'asdasd' }, workspace.id]
        );
        const response = await server.inject({
          method: 'POST',
          url: `/workspaces/${workspace.id}/invite/slack`,
          payload: {
            slackUserId: 'JUHSYND1'
          },
          headers: { Authorization: `Bearer ${tokens.accessToken}` }
        });
        expect(response.statusCode).equals(400);
        expect(response.payload).includes('UserNotAuthedWithSlack');
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
          url: `/workspaces/${workspace.id}/invite/slack`,
          payload: {
            slackUserId
          },
          headers: { Authorization: `Bearer ${tokens.accessToken}` }
        });
        expect(response.statusCode).equals(200);
        expect(stubbedMethods.sendInviteToWorkspaceBySlack.calledOnce).true();
        const args = stubbedMethods.sendInviteToWorkspaceBySlack.args[0][0];
        expect(args[0]).equals(senderSlackUserId);
        expect(args[1]).equals(slackAccessToken);
        expect(args[2]).equals(slackUserId);
        expect(args[3]).equals(workspace.name);
      });
    });
  });

  /**
   * Email verification functionality
   */
  describe('POST /vefiry/{code}', () => {
    describe('Try to verify not existed verification code', () => {
      it('should return fail status, reason should be "invalid code"', async () => {
        const response = await server.inject({
          method: 'GET',
          url: `/verify/${(await crypto.randomBytes(41)).toString('hex')}`
        });
        expect(response.statusCode).equals(400);
        const payload = JSON.parse(response.payload);
        expect(payload.message).equals('Verification code is not valid');
      });
    });
    describe('Try to verify an expired verification code', () => {
      it('should return fail status, reason should be "invalid code"', async () => {
        const { userService } = server.services();
        const db = server.plugins['hapi-pg-promise'].db;
        const user = await userService.signup({ email: 'admin@admin.ru' });
        const expiredDate = new Date(Date.now() - 1);
        const query = `
          UPDATE verification_codes
          SET expired_at=$1
          WHERE user_id=$2
          RETURNING *
        `;
        const record = await db.one(query, [expiredDate, user.id]);
        const fullCode = serviceHelpers.codeConvertToUrl(record.id, record.code);
        const response = await server.inject({
          method: 'GET',
          url: `/verify/${fullCode}`
        });
        expect(response.statusCode).equals(400);
        const payload = JSON.parse(response.payload);
        expect(payload.message).equals('Verification code is not valid');
      });
    });
    describe('Try to verify verification code, but email are not matched', () => {
      it('should return fail status, reason should be "invalid code"', async () => {
        const { userService } = server.services();
        const db = server.plugins['hapi-pg-promise'].db;
        const user = await userService.signup({ email: 'admin@admin.ru' });
        await db.none('UPDATE users SET email=$1 WHERE id=$2', ['notadmin@admin.ru', user.id]);
        const fullCode = stubbedMethods.sendEmail.firstCall.args[0][1];
        const response = await server.inject({
          method: 'GET',
          url: `/verify/${fullCode}`
        });
        expect(response.statusCode).equals(400);
        const payload = JSON.parse(response.payload);
        expect(payload.message).equals('Verification code is not valid');
      });
    });
    describe('Try to verify valid verification code', () => {
      it('should set "email_verified" true, should delete verification code', async () => {
        const { userService } = server.services();
        const db = server.plugins['hapi-pg-promise'].db;
        const user = await userService.signup({ email: 'admin@admin.ru' });
        const fullCode = stubbedMethods.sendEmail.firstCall.args[0][1];
        const response = await server.inject({
          method: 'GET',
          url: `/verify/${fullCode}`
        });
        expect(response.statusCode).equals(200);
        // check is email verified
        const userUpdated = await userService.findById(user.id);
        expect(userUpdated.is_email_verified).true();
        // check verification code is not exist
        const verificationCode = await db.oneOrNone('SELECT * FROM verification_codes WHERE user_id=$1', [user.id]);
        expect(verificationCode).null();
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
});
