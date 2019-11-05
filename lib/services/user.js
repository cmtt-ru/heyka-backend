'use strict';

const Schmervice = require('schmervice');
const uuid4 = require('uuid/v4');
const accessTokenLifespan = 5 * 60 * 1000;
const refreshTokenLifespan = 31 * 24 * 60 * 60 * 1000;

module.exports = class UserService extends Schmervice.Service {

  constructor (...args) {
    super(...args);
  }

  /* TODO: rewrite with database */
  async findByEmail (email) {
    const userKeys = await this.server.redis.client.keys(`user:*`);
    const users = (await Promise.all(
      userKeys.map(userKey => this.server.redis.client.get(userKey))
    )).map(user => JSON.parse(user))
    return users.find(user => user.email === email)
  }

  /* TODO: rewrite with database */
  async findById (id) {
    const userInfo = await this.server.redis.client.get(`user:${id}`)
    if (!userInfo) throw new Error('Cannot find user');
    return JSON.parse(userInfo)
  }

  /* TODO: rewrite with database */
  async signup (userInfo) {
    let user = await this.findByEmail(userInfo.email);
    if (user) throw new Error('EmailExists');
    const id = uuid4();
    user = { id, ...userInfo };
    await this.server.redis.client.set(`user:${id}`, JSON.stringify(user));
    return user;
  }

  async createTokens (user) {
    const access = uuid4()
    const refresh = uuid4()
    const accessTokenInfo = {
      expired: Date.now() + accessTokenLifespan,
      userId: user.id
    }
    const refreshTokenInfo = {
      expired: Date.now() + refreshTokenLifespan,
      userId: user.id,
      accessToken: access
    }
    /* TODO: don't forget keeping refresh token in database */
    const { client } = this.server.redis
    await Promise.all([
      client.set(`accessToken:${access}`, JSON.stringify(accessTokenInfo)),
      client.set(`refreshToken:${refresh}`, JSON.stringify(refreshTokenInfo))
    ])
    return { access, refresh }
  }

  async findAccessToken (token) {
    const { client } = this.server.redis;
    const tokenInfo = await client.get(`accessToken:${token}`);
    return tokenInfo ? JSON.parse(tokenInfo) : null
  }

  async findRefreshToken (token) {
    const { client } = this.server.redis;
    const tokenInfo = await client.get(`refreshToken:${token}`);
    return tokenInfo ? JSON.parse(tokenInfo) : null
  }

  async deleteAccessToken (token) {
    await this.server.redis.client.del(`accessToken:${token}`)
  }

  async deleteRefreshToken (token) {
    const tokenInfo = await this.findRefreshToken(token);
    if (!tokenInfo) return;
    await this.deleteAccessToken(tokenInfo.accessToken);
    await this.server.redis.client.del(`refreshToken:${token}`)
  }

  async refreshToken (token) {
    const tokenInfo = await this.findRefreshToken(token);
    if (!tokenInfo) throw new Error('Cannot find refresh token');
    const user = await this.findById(tokenInfo.userId);
    await this.deleteRefreshToken(token);
    return await this.createTokens(user)
  }
};
