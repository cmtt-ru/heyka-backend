'use strict';

const Lab = require('@hapi/lab');
const { describe, it, before, afterEach } = exports.lab = Lab.script();
const createServer = require('../server');
const { expect } = require('@hapi/code');
const uuid4 = require('uuid/v4')

describe('Test sandbox routes', () => {
  let server = null
  before(async () => {
    server = await createServer()
  })
  afterEach(async () => {
    server.redis.client.flushdb()
  })
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
        const token = uuid4();
        const tokenPayload = {
          expiredTime: Date.now() - 2019
        };
        await server.redis.client.set(`token:${token}`, JSON.stringify(tokenPayload));
        const response = await server.inject({
          method: 'GET',
          url: '/protected',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        expect(response.statusCode).to.be.equal(401);
      });
    });
    describe('With a valid bearer token', () => {
      it('returns 401 unauthorized error', async () => {
        const token = uuid4();
        const tokenPayload = {
          expiredTime: Date.now() + 2019
        };
        await server.redis.client.set(`token:${token}`, JSON.stringify(tokenPayload));
        const response = await server.inject({
          method: 'GET',
          url: '/protected',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        expect(response.statusCode).to.be.equal(200);
        expect(response.payload).to.be.equal('OK');
      });
    });
  });
});
