'use strict';

const Schmervice = require('schmervice');
const pgPromise = require('pg-promise')();
const schemas = require('../../schemas');

const redisKeys = {
  stateForUser: (id, socket) => `state-user-${id}-${socket}`,
  onlineStatusForUser: (id, workspace) => `user-online-status-${id}-${workspace}`,
  workspaceForSocket: (socketId) => `workspace-for-socket-${socketId}`,
};
const REDIS_ACCESS_TOKEN_PREFIX = 'ACCESS_TOKEN:';
const SLACK_STATE_PREFIX = 'SLACK_STATE:';

/**
 * Online statuses of users
 * @enum {string}
 */
const onlineStatuses = {
  online: 'online',
  idle: 'idle',
  offline: 'offline'
};

const UserColumnSet = new pgPromise.helpers.ColumnSet([
  'id',
  { name: 'email', def: null },
  { name: 'avatar', def: null },
  'name',
  { name: 'password_hash', def: null },
  { name: 'password_salt', def: null },
  { name: 'is_email_verified', def: false },
  { name: 'lang', def: null },
  'updated_at',
  'created_at',
  {
    name: 'device_tokens',
    def: [],
    cast: 'text[]',
  },
  {
    name: 'platform_endpoints',
    def: {},
    mod: ':json',
  },
  {
    name: 'app_settings',
    def: {},
    mod: ':json',
  },
  {
    name: 'invite_id',
    def: null,
  },
  {
    name: 'auth',
    def: {},
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

const UserRelationsColumnSet = new pgPromise.helpers.ColumnSet([
  'user1',
  'user2',
  'workspace_id',
  'calls_count',
  'latest_call',
], { table: 'user_relations' });


class UserDatabaseService extends Schmervice.Service {

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
   * Returns count of users
   */
  async getUsersCount() {
    const db = this.server.plugins['hapi-pg-promise'].db;

    const result = await db.query('SELECT COUNT(DISTINCT id)  FROM users');

    const {count} = result[0];

    return +count;
  }

  /**
   * Finds list of users by their ids
   * @param {Array<string>} userIds User ids
   * @returns {Array<object>} Found users
   */
  async findSeveralUsers(userIds) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    return await db.any('SELECT * FROM users WHERE id IN ($1:csv)', [userIds]);
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
   * Return relation between two users
   * 
   * @param {string} user1 User 1 id
   * @param {string} user2 User 2 id
   */
  async getRelationBetweenUsers(user1, user2) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    const result = await db.oneOrNone('SELECT * FROM user_relations WHERE user1=$1 AND user2=$2', [user1, user2]);
    return result;
  }

  /**
   * Create relation between two users
   * 
   * @param {object} body Relation body
   */
  async insertRelationBetweenUsers(body) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    const q = pgPromise.helpers.insert(body, UserRelationsColumnSet);
    await db.none(q);
  }

  /**
   * Update relation between users
   * 
   * @param {string} user1 User 1
   * @param {string} user2 User 2
   * @param {object} update Record update object
   */
  async updateRelationBetweenUsers(user1, user2, update) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    const query = pgPromise.helpers.update(update, null, 'user_relations')
      + pgPromise.as.format(' WHERE user1=$1 AND user2=$2', [user1, user2]);
    await db.none(query);
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
   * Updates user in the database
   * @param {string} userId User id
   * @param {object} update Update object
   */
  async updateUser(userId, update) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    const query = pgPromise.helpers.update(update, null, 'users')
      + pgPromise.as.format(' WHERE id=$1', [userId]);
    await db.none(query);
  }

  /**
   * Delete user from database
   * @param {string} userId User id
   */
  async deleteUser(userId) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    const query = 'DELETE FROM users WHERE id=$1';
    await db.none(query, [userId]);
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
   * Get all user sessions
   * @param {string} userId User id
   */
  async getAllUserSessions(userId) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    return await db.any('SELECT * FROM sessions WHERE user_id=$1', [userId]);
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
   * Finds session by previous refresh token
   * @param {string} refreshToken Token string
   */
  async findSessionByPrevious(refreshToken) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    const session = await db.oneOrNone('SELECT * FROM sessions WHERE prev_refresh_token = $1', refreshToken);
    return session;
  }

  /**
   * Finds session by access token
   * @param {string} accessToken Token string
   */
  async findSessionByAccessToken(accessToken) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    const session = await db.oneOrNone('SELECT * FROM sessions WHERE access_token = $1', accessToken);
    return session;
  }

  /**
   * Finds session by session id
   * @param {string} id Session id
   */
  async findSessionById(id) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    const session = await db.oneOrNone('SELECT * FROM sessions WHERE id = $1', id);
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

  /**
   * Saves slack state (read slack API documentation) to the database
   * @param {string} operationId Unique string, operation id
   * @param {object} details Operation details (connect slack workspace, etc.)
   */
  async saveSlackState(operationId, details) {
    const { client } = this.server.redis;
    await client.set(`${SLACK_STATE_PREFIX}${operationId}`, JSON.stringify(details));
  }
  
  /**
   * Returns details of slack operation by operation id (slack state)
   * @param {string} operationId Unique string, operation id
   */
  async getSlackState(operationId) {
    const { client } = this.server.redis;
    const data = await client.get(`${SLACK_STATE_PREFIX}${operationId}`);
    return data ? JSON.parse(data) : null;
  }

  async setUserMediaState(userId, state) {
    const { client } = this.server.redis;
    schemas.userMediaState.validate(state);
    await client.set(redisKeys.stateForUser(userId), JSON.stringify(state));
  }

  async getUserMediaState(userId) {
    const { client } = this.server.redis;
    const stateJSON = await client.get(redisKeys.stateForUser(userId));
    if (!stateJSON) return null;
    const state = JSON.parse(stateJSON);
    return state;
  }

  /**
   * Returns online status of the given user for the given workspace
   * @param {string} userId User id
   * @param {string} workspaceId Workspace id
   * @returns {onlineStatuses}
   */
  async getOnlineStatus(userId, workspaceId) {
    const { client } = this.server.redis;
    const status = await client.get(redisKeys.onlineStatusForUser(userId, workspaceId));
    return status || onlineStatuses.offline;
  }

  /**
   * Set online status for the user in the workspace
   * @param {string} userId User id
   * @param {string} workspaceId Workspace id
   * @param {onlineStatuses} status Online status
   * @returns {undefined}
   */
  async setOnlineStatus(userId, workspaceId, status) {
    const { client } = this.server.redis;
    await client.set(redisKeys.onlineStatusForUser(userId, workspaceId), status);
  }

  /**
   * Set workspace for socket
   * @param {string} socketId Socket id
   * @param {string} workspaceId Workspace id
   * @returns {undefined}
   */
  async setWorkspaceForSocket(socketId, workspaceId) {
    const { client } = this.server.redis;
    await client.set(redisKeys.workspaceForSocket(socketId), workspaceId);
  }

  /**
   * Removes workspace for socket
   * @param {string} socketId Socket id
   * @returns {undefined}
   */
  async removeWorkspaceForSocket(socketId) {
    const { client } = this.server.redis;
    await client.del(redisKeys.workspaceForSocket(socketId));
  }

  /**
   * Get workspace for socket
   * @param {string} socketId Socket id
   * @returns {string} Workspace id for that socket id
   */
  async getWorkspaceForSocket(socketId) {
    const { client } = this.server.redis;
    return await client.get(redisKeys.workspaceForSocket(socketId));
  }
}

module.exports = UserDatabaseService;
