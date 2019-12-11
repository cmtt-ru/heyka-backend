'use strict';

const Lab = require('@hapi/lab');
const { describe, it, before, beforeEach } = exports.lab = Lab.script();
const createServer = require('../server');
const { expect } = require('@hapi/code');
const uuid4 = require('uuid/v4');

describe('Test sandbox routes', () => {
  let server = null;
  before(async () => {
    server = await createServer();
  });
  beforeEach(async () => {
    await server.redis.client.flushdb();
    await server.plugins['hapi-pg-promise'].db.query('DELETE FROM users');
    await server.plugins['hapi-pg-promise'].db.query('DELETE FROM sessions');
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
});
