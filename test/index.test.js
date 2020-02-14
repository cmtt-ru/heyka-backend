'use strict';

const Lab = require('@hapi/lab');
const { describe, it, before, beforeEach } = exports.lab = Lab.script();
const createServer = require('../server');
const { expect } = require('@hapi/code');
const uuid4 = require('uuid/v4');
const mockery = require('mockery');
const path = require('path');
const Schmervice = require('schmervice');
const sinon = require('sinon');
const crypto = require('crypto-promise');
const serviceHelpers = require('../lib/services/helpers');

// Stubbed methods to check external services
const stubbedMethods = {
  sendEmail: sinon.stub()
};

// mock services that make requests to external APIs
const pathToEmailService = path.resolve(__dirname, '../lib/services/email.js');
const pathToJanusService = path.resolve(__dirname, '../lib/services/janus_workspace.js');
mockery.enable({
  warnOnReplace: false,
  warnOnUnregistered: false // disable warnings on unmocked modules
});
mockery.registerMock(
  pathToJanusService,
  class JanusWorkspaceService extends Schmervice.Service {
    createServer() {
      return {};
    }
    createAudioVideoRooms() {
      return { audioRoomId: 'id', videoRoomId: 'id' };
    }
    addAuthTokenForWorkspace() {}
  }
);
mockery.registerMock(
  pathToEmailService,
  class EmailService extends Schmervice.Service {
    sendEmailVerificationCode() {
      stubbedMethods.sendEmail(arguments);
    }
  }
);

describe('Test routes', () => {
  let server = null;

  before(async () => {
    server = await createServer();
  });

  beforeEach(async () => {
    const db = server.plugins['hapi-pg-promise'].db;
    await server.redis.client.flushdb();
    await db.query('DELETE FROM verification_codes');
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
            'Authorization': `Bearer ${tokens.access}`
          }
        });
        expect(response.statusCode).to.be.equal(401);
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
            'Authorization': `Bearer ${tokens.access}`
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
        await userService.signup({ email: 'admin@example.com', password: 'qwerty' });
        const response = await server.inject({
          method: 'POST',
          url: '/signin',
          payload: { credentials: { email: 'admin@example.com', password: 'qwerty' } }
        });
        expect(response.statusCode).to.be.equal(200);
        const payload = JSON.parse(response.payload);
        expect(payload.user).includes('accessToken');
        expect(payload.user).includes('refreshToken');
        expect(payload.user).includes('id');
        expect(await userService.findAccessToken(payload.user.accessToken)).to.be.an.object();
        expect(await userService.findRefreshToken(payload.user.refreshToken)).to.be.an.object();
      });
    });
  });

  describe('POST /signup', () => {
    describe('sign up with an existed email', () => {
      it('returns 401', async () => {
        const userPayload = { email: 'admin@example.com', password: 'qwerty' };
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
          payload: { user: { email: 'admin@example.com', password: 'qwerty' } }
        });
        expect(response.statusCode).to.be.equal(200);
        const payload = JSON.parse(response.payload);
        expect(payload.user).includes('accessToken');
        expect(payload.user).includes('refreshToken');
        expect(payload.user).includes('id');
        expect(await userService.findAccessToken(payload.user.accessToken)).to.be.an.object();
        expect(await userService.findRefreshToken(payload.user.refreshToken)).to.be.an.object();
      });
      it('call "sendEmail" stubbed method (email with verification code is sent', async () => {
        const email = 'admin@example.com';
        const response = await server.inject({
          method: 'POST',
          url: '/signup',
          payload: { user: { email, password: 'qwerty' } }
        });
        expect(response.statusCode).to.be.equal(200);
        // check that email is sent
        expect(stubbedMethods.sendEmail.calledOnce).true();
        expect(stubbedMethods.sendEmail.args[0][0][0]).equals(email);
      });
    });
  });

  describe('POST /refresh_token', () => {
    describe('Incorrect request without tokens', () => {
      it('Should return 400 Bad Request', async () => {
        const response = await server.inject({
          method: 'POST',
          url: '/refresh_token',
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
          url: '/refresh_token',
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
          url: '/refresh_token',
          payload: { accessToken: uuid4(), refreshToken: tokens.refresh }
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
          url: '/refresh_token',
          payload: { accessToken: tokens.access, refreshToken: tokens.refresh }
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
          url: '/refresh_token',
          payload: { accessToken: tokens.access, refreshToken: tokens.refresh }
        });
        expect(response.statusCode).to.be.equal(200);
        const payload = JSON.parse(response.payload);
        expect(payload).includes('accessToken');
        expect(payload).includes('refreshToken');
        expect(await userService.findAccessToken(tokens.access)).to.be.null();
        expect(await userService.findRefreshToken(tokens.refresh)).to.be.null();
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
            'Authorization': `Bearer ${tokens.access}`
          },
          payload: {
            name: 'TestWorkspace'
          }
        });
        expect(response.statusCode).to.be.equal(200);
        const payload = JSON.parse(response.payload);
        expect(payload).includes('workspace');
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
        const workspace = await workspaceService.createWorkspace(admin, 'testWorkspace');
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
        const workspace = await workspaceService.createWorkspace(admin, 'testWorkspace');
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
        expect(response.statusCode).to.be.equal(200);
        const result = JSON.parse(response.payload);
        expect(result.channel.id).exists();
        expect(result.channel.name).exists();
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
        const workspace = await workspaceService.createWorkspace(admin, 'testWorkspace');
        // add guest to the workspace as a guest
        await workspaceService.addUserToWorkspace(workspace.id, guest.id, 'guest');
        const response = await server.inject({
          method: 'POST',
          url: `/workspaces/${workspace.id}/invites`,
          headers: {
            'Authorization': `Bearer ${tokens.access}`
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
        const workspace = await workspaceService.createWorkspace(admin, 'testWorkspace');
        const response = await server.inject({
          method: 'POST',
          url: `/workspaces/${workspace.id}/invites`,
          headers: {
            'Authorization': `Bearer ${tokens.access}`
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
        const admin = await userService.signup({ email: 'admin@user.net' });
        // create workspace
        const workspace = await workspaceService.createWorkspace(admin, 'testWorkspace');
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
        expect(response.statusCode).to.be.equal(200);
        const body = JSON.parse(response.payload);
        expect(body.valid).equals(false);
      });
    });

    describe('Invite code is valid', () => {
      it('should return status "valid", info about the user who invited and info about workspace', async () => {
        const {
          userService,
          workspaceService
        } = server.services();
        // create users
        const admin = await userService.signup({ email: 'admin@user.net' });
        // create workspace
        const workspace = await workspaceService.createWorkspace(admin, 'testWorkspace');
        // create invite code
        const code = await workspaceService.inviteToWorkspace(workspace.id, admin.id);
        const response = await server.inject({
          method: 'GET',
          url: `/check/${code.fullCode}`
        });
        expect(response.statusCode).to.be.equal(200);
        const body = JSON.parse(response.payload);
        expect(body.valid).equals(true);
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
        const workspace = await workspaceService.createWorkspace(admin, 'testWorkspace');
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
            'Authorization': `Bearer ${tokens.access}`
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
        const workspace = await workspaceService.createWorkspace(admin, 'testWorkspace');
        // create invite code
        const code = await workspaceService.inviteToWorkspace(workspace.id, admin.id);
        const response = await server.inject({
          method: 'POST',
          url: `/join/${code.fullCode}`,
          headers: {
            'Authorization': `Bearer ${tokens.access}`
          },
        });
        expect(response.statusCode).to.be.equal(200);
        const workspaces = await wdb.getWorkspacesByUserId(user.id);
        expect(workspaces.length).equals(1);
        expect(workspaces[0].id).equals(workspace.id);
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
        expect(response.statusCode).equals(200);
        const payload = JSON.parse(response.payload);
        expect(payload.status).equals('fail');
        expect(payload.reason).equals('Verification code is not valid');
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
        expect(response.statusCode).equals(200);
        const payload = JSON.parse(response.payload);
        expect(payload.status).equals('fail');
        expect(payload.reason).equals('Verification code is not valid');
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
        expect(response.statusCode).equals(200);
        const payload = JSON.parse(response.payload);
        expect(payload.status).equals('fail');
        expect(payload.reason).equals('Verification code is not valid');
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
        const payload = JSON.parse(response.payload);
        expect(payload.status).equals('success');
        // check is email verified
        const userUpdated = await userService.findById(user.id);
        expect(userUpdated.is_email_verified).true();
        // check verification code is not exist
        const verificationCode = await db.oneOrNone('SELECT * FROM verification_codes WHERE user_id=$1', [user.id]);
        expect(verificationCode).null();
      });
    });
  });
});
