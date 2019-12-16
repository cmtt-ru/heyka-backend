'use strict';

const Schmervice = require('schmervice');
const pgPromise = require('pg-promise')();
const REDIS_ACCESS_TOKEN_PREFIX = 'ACCESS_TOKEN:';

const UserColumnSet = new pgPromise.helpers.ColumnSet([
  'id',
  'email',
  'password_hash',
  'password_salt',
  'updated_at',
  'created_at',
  {
    name: 'auth',
    def: '{}',
    mod: ':json'
  }
], { table: 'users' });

const SessionColumnSet = new pgPromise.helpers.ColumnSet([
  'id',
  'access_token',
  'refresh_token',
  'user_id',
  'created_at',
  'refreshed_at',
  'expired_at',
  {
    name: 'session_info',
    def: '{}',
    mod: ':json'
  }
], { table: 'sessions'});

module.exports = class UserDatabaseService extends Schmervice.Service {

  constructor (...args) {
    super(...args);
  }

  /**
   * Finds user in database by id
   * @param {uuid} id User id
   * @returns {?object} Found user
   */
  async findById (id) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    return await db.oneOrNone('SELECT * FROM users WHERE id=$1', id);
  }

  /**
   * Finds user in database by email
   * @param {string} email User id
   * @returns {?object} Found user
   */
  async findByEmail (email) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    return await db.oneOrNone('SELECT * FROM users WHERE email=$1', email);
  }

  /**
   * Finds user in database by external authenticator id
   * @param {string} externalAuthenticator google|slack|facebook ...
   * @param {string} id 
   * @returns {?object} Found user
   */
  async findByExternalAuthenticatorId (externalAuthenticator, id) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    const user = await db.oneOrNone('SELECT * FROM users WHERE auth @> ${this}', { [externalAuthenticator]: { id } });
    return user;
  }

  /**
   * Insert user to the database
   * @param {object} user User object
   */
  async insert(user) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    const query = pgPromise.helpers.insert(user, UserColumnSet);
    await db.none(query);
  }

  /**
   * Insert refresh token to the database
   * @param {object} token Token object
   */
  async insertSession(token) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    const query = pgPromise.helpers.insert(token, SessionColumnSet);
    await db.none(query);
  }

  /**
   * Updates session in the database using session id
   * @param {uuid} tokenId Token id
   * @param {object} update Update object
   */
  async updateSession(tokenId, update) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    const query = pgPromise.helpers.update(update, null, 'sessions')
      + pgPromise.as.format(' WHERE id=$1', tokenId);
    await db.none(query);
  }
  
  /**
   * Finds session by refresh token
   * @param {string} refreshToken Token string
   */
  async findSession(refreshToken) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    const session = await db.oneOrNone('SELECT * FROM sessions WHERE refresh_token = $1', refreshToken);
    return session;
  }

  /**
   * Deletes refresh token from the database by refresh token
   * @param {string} refreshToken Token string
   */
  async deleteSession(refreshToken) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    const session = await db.none('DELETE FROM sessions WHERE refresh_token = $1', refreshToken);
    return session;
  }

  /**
   * Insert access token to the database
   * @param {string} token Token string
   * @param {object} info Token info
   */
  async insertAccessToken(token, info) {
    const { client } = this.server.redis;
    await client.set(`${REDIS_ACCESS_TOKEN_PREFIX}${token}`, JSON.stringify(info));
  }

  /**
   * Finds access token in the database and return token info or null object
   * @param {string} token Token string
   * @returns {?object} token info
   */
  async findAccessToken(token) {
    const { client } = this.server.redis;
    const data = await client.get(`${REDIS_ACCESS_TOKEN_PREFIX}${token}`);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Deletes token from the database
   * @param {string} token Token string
   */
  async deleteAccessToken(token) {
    const { client } = this.server.redis;
    return client.del(`${REDIS_ACCESS_TOKEN_PREFIX}${token}`);
  }

};
