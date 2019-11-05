'use strict';

const Lab = require('@hapi/lab');
const { describe, it, before, beforeEach } = exports.lab = Lab.script();
const createServer = require('../../server');
const { expect } = require('@hapi/code');

describe('POST /signin', () => {
  let server = null

  before(async () => {
    server = await createServer()
  })
  beforeEach(async () => {
    await server.redis.client.flushdb()
  })
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
      const user = await userService.signup({ email: 'admin@example.com', password: 'qwerty' });
      const response = await server.inject({
        method: 'POST',
        url: '/signin',
        payload: { credentials: { email: 'admin@example.com', password: 'not qwerty' } }
      });
      expect(response.statusCode).to.be.equal(401);
      expect(response.payload).includes('Email or password are invalid');
    })
  });
  describe('sign in with valid credentials', () => {
    it('returns user info and tokens', async () => {
      const { userService } = server.services();
      const user = await userService.signup({ email: 'admin@example.com', password: 'qwerty' });
      const response = await server.inject({
        method: 'POST',
        url: '/signin',
        payload: { credentials: { email: 'admin@example.com', password: 'qwerty' } }
      });
      expect(response.statusCode).to.be.equal(200);
      const payload = JSON.parse(response.payload)
      expect(payload.user).includes('accessToken')
      expect(payload.user).includes('refreshToken')
      expect(payload.user).includes('id')
      expect(await userService.findAccessToken(payload.user.accessToken)).to.be.an.object()
      expect(await userService.findRefreshToken(payload.user.refreshToken)).to.be.an.object()
    })
  })
});  
