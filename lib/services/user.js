'use strict';

const Schmervice = require('schmervice');
const uuid4 = require('uuid/v4');
const bcrypt = require('bcrypt');
const pgPromise = require('pg-promise')();
const SALT_ROUNDS = 8;
const ACCESS_TOKEN_LIFESPAN = 5 * 60 * 1000;
const REFRESH_TOKEN_LIFESPAN = 31 * 24 * 60 * 60 * 1000;

module.exports = class UserService extends Schmervice.Service {

  constructor (...args) {
    super(...args);
  }

  /**
   * Returns found user or null
   * @param {string} email
   * @returns {?object} Object represents a found user 
   */
  async findByEmail (email) {
    const user = await this.server.services().userDatabaseService.findByEmail(email);
    return user;
  }

  /**
   * Returns found user or null
   * @param {uuid} id
   * @returns {?object} Object represents a found user 
   */
  async findById (id) {
    const user = await this.server.services().userDatabaseService.findById(id);
    return user;
  }

  /**
   * Returns found user or null
   * @param {string} externalAuthenticator google|slack|facebook ...
   * @param {string} id 
   * @returns {?object} Object represents a found user
   */
  async findByExternalAuthenticatorId (externalAuthenticator, id) {
    const user = await this.server.services().userDatabaseService.findByExternalAuthenticatorId(externalAuthenticator, id);
    return user;
  }

  /**
   * Signs up user
   * @param {object} userInfo Object with signup details
   * @returns {object} Ready to use user object
   */
  async signup (userInfo) {
    const { userDatabaseService } = this.server.services();
    let user = await userDatabaseService.findByEmail(userInfo.email);
    if (user) throw new Error('EmailExists');
    const id = uuid4();
    const now = new Date();
    let passwordSalt, passwordHash;
    if (userInfo.password) {
      passwordSalt = await bcrypt.genSalt(SALT_ROUNDS);
      passwordHash = await bcrypt.hash(userInfo.password, passwordSalt);
    }
    user = {
      id,
      email: userInfo.email,
      password_hash: passwordHash,
      password_salt: passwordSalt,
      created_at: now,
      updated_at: now,
      auth: userInfo.auth || {}
    };
    await userDatabaseService.insert(user);
    return user;
  }

  /**
   * Checks password and returns user object
   * @param {object} userInfo Sign in details (email, password)
   * @returns {object} User object from the database
   */
  async signin (userInfo) {
    const { userDatabaseService } = this.server.services();
    let user = await userDatabaseService.findByEmail(userInfo.email)
    if (!user) throw new Error('UserNotFound');
    if (!user.password_hash) throw new Error('InvalidPassword');
    const match = await bcrypt.compare(userInfo.password, user.password_hash);
    if (!match) throw new Error('InvalidPassword');
    return user;
  }

  /**
   * Creates auth tokens for a certain user.
   * Access token is kept by Redis
   * Refresh token is kept by postgres database
   * @param {object} user User the tokens for are created
   * @param {*} accessTokenLifespan How long the access_token will be valid (ms)
   * @param {*} refreshTokenLifespan How long the refresh_token will be valid (ms)
   * @return {object} { access, refresh }
   */
  async createTokens (
    user,
    accessTokenLifespan = ACCESS_TOKEN_LIFESPAN, 
    refreshTokenLifespan = REFRESH_TOKEN_LIFESPAN
  ) {
    const { userDatabaseService } = this.server.services();
    const access = await this.createAccessToken(user, accessTokenLifespan);
    const refresh = uuid4();
    const now = new Date();
    const expired_at = new Date(Date.now() + refreshTokenLifespan);
    const refreshTokenInfo = {
      id: uuid4(),
      expired_at,
      created_at: now,
      refreshed_at: now,
      user_id: user.id,
      access_token: access,
      refresh_token: refresh,
    };
    await userDatabaseService.insertSession(refreshTokenInfo);
    return { access, refresh };
  }

  /**
   * Creates access token and saves it to Redis
   * @param {object} user User
   * @param {number} accessTokenLifespan How long access_token will be valid
   */
  async createAccessToken (user, accessTokenLifespan = ACCESS_TOKEN_LIFESPAN) {
    const { userDatabaseService } = this.server.services();
    const access = uuid4();
    const info = {
      expired: Date.now() + accessTokenLifespan,
      userId: user.id
    };
    await userDatabaseService.insertAccessToken(access, info);
    return access;
  }

  /**
   * Finds access token in Redis and returns info
   * @param {string} token Access token
   * @returns {object} Object with access token info
   */
  async findAccessToken (token) {
    const { userDatabaseService } = this.server.services();
    return userDatabaseService.findAccessToken(token);
  }

  /**
   * Finds refresh token in database and returns info
   * @param {string} token Refresh token
   * @returns {object} Object with refresh token info
   */
  async findRefreshToken (token) {
    const { userDatabaseService } = this.server.services();
    return userDatabaseService.findSession(token);
  }

  /**
   * Deletes access token from Redis
   * @param {string} token Access token
   */
  async deleteAccessToken (token) {
    const { userDatabaseService } = this.server.services();
    await userDatabaseService.deleteAccessToken(token);
  }

  /**
   * Deletes refresh token and finds and deleted access token that is belong to refresh token.
   * @param {string} token Refresh token
   */
  async deleteRefreshToken (token) {
    const { userDatabaseService } = this.server.services();
    const sessionInfo = await userDatabaseService.findSession(token);
    if (!sessionInfo) return;
    await Promise.all([
      userDatabaseService.deleteAccessToken(sessionInfo.access_token),
      userDatabaseService.deleteSession(token)
    ]);
  }

  /**
   * Updates refresh token and recreates access token
   * @param {string} accessToken Access token
   * @param {string} refreshToken Refresh token
   * @param {*} accessTokenLifespan How long the access_token will be valid (ms)
   * @param {*} refreshTokenLifespan How long the refresh_token will be valid (ms)
   * @returns {object} Access and refresh token
   */
  async refreshToken (
    accessToken, 
    refreshToken, 
    accessTokenLifespan = ACCESS_TOKEN_LIFESPAN, 
    refreshTokenLifespan = REFRESH_TOKEN_LIFESPAN
  ) {
    const { userDatabaseService } = this.server.services();
    const tokenInfo = await userDatabaseService.findSession(refreshToken);
    // Refresh token is not found, throw error
    if (!tokenInfo) throw new Error('RefreshTokenNotFound');
    // Access token and refresh token should be matched with that are sent by user
    if (tokenInfo.access_token !== accessToken) throw new Error('AccessTokenNotMatched');
    // Found refresh token can't be expired
    if (new Date(tokenInfo.expired_at).getTime() < new Date().getTime()) throw new Error('RefreshTokenExpired');
    await userDatabaseService.deleteAccessToken(accessToken);
    const user = await userDatabaseService.findById(tokenInfo.user_id);
    const access = await this.createAccessToken(user, accessTokenLifespan);
    const refresh = uuid4();
    const updateRefreshToken = {
      refresh_token: refresh,
      access_token: access,
      expired_at: new Date(Date.now() + refreshTokenLifespan),
      refreshed_at: new Date()
    };
    await userDatabaseService.updateSession(tokenInfo.id, updateRefreshToken);
    return { access, refresh };
  }
};
