'use strict';

const Lab = require('@hapi/lab');
const { describe, it, before, beforeEach } = exports.lab = Lab.script();
const createServer = require('../../server');
const { expect } = require('@hapi/code');

describe('Test sandbox routes', () => {
  let server = null

  before(async () => {
    server = await createServer()
  })
  beforeEach(async () => {
    await server.redis.client.flushdb()
  })
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
        const { userService } = server.services()
        const response = await server.inject({
          method: 'POST',
          url: '/signup',
          payload: { user: { email: 'admin@example.com', password: 'qwerty' } }
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
});  
