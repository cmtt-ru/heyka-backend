'use strict';

const Schmervice = require('schmervice');
const redisKeys = {
  workspace: id => `workspace:${id}`,
  user: id => `user:${id}`,
  channel: id => `channel:${id}`,
  connection: id => `connection:${id}`
};
const ONLINE_STATUS_LIFESPAN = 30 * 1000; // 30 seconds

module.exports = class ConnectionService extends Schmervice.Service {

  constructor (...args) {
    super(...args);
  }

  /**
   * Get all workspace's connections
   * @param {string} workspaceId Workspace id
   * @returns {Array<Object>} Array of connection objects
   */
  async getWorkspaceConnections (workspaceId) {
    const { client } = this.server.redis;
    const allConnections = await client.hgetall(redisKeys.workspace(workspaceId));
    const aliveConnections = [];
    const now = Date.now();
    for (let connectionId in allConnections) {
      const conn = JSON.parse(allConnections[connectionId]);
      if (conn.expiredAt < now) {
        await this._deleteConnection(conn.connectionId, conn.workspaceId, conn.userId, conn.channelId);
      } else {
        aliveConnections.push(conn);
      }
    }
    return aliveConnections;    
  }
  
  /**
   * Get the connection
   * @param {string} connectionId Connection id
   * @returns {object} Connection object
   */
  async getConnection(connectionId) {
    const { client } = this.server.redis;
    const conn = await client.get(redisKeys.connection(connectionId));
    if (!conn) return null;
    return JSON.parse(conn);
  }

  /**
   * Get all user's connections
   * @param {string} userId User id
   * @param {string} workspaceId Workspace id
   * @returns {Array<Object>} Array of users connections
   */
  async getUserConnections(userId, workspaceId) {
    const { client } = this.server.redis;
    const allConnections = await client.hgetall(redisKeys.user(userId));
    const aliveConnections = [];
    const now = Date.now();
    for (let connectionId in allConnections) {
      const conn = JSON.parse(allConnections[connectionId]);
      if (conn.workspaceId !== workspaceId) continue;
      if (conn.expiredAt < now) {
        await this._deleteConnection(conn.connectionId, conn.workspaceId, conn.userId, conn.channelId);
      } else {
        aliveConnections.push(conn);
      }
    }
    return aliveConnections;
  }

  /**
   * Get all channel's connections
   * @param {string} channelId Channel id
   * @returns {Array<Object>} Array of channel connections
   */
  async getChannelConnections(channelId) {
    const { client } = this.server.redis;
    const allConnections = await client.hgetall(redisKeys.channel(channelId));
    const aliveConnections = [];
    const now = Date.now();
    for (let connectionId in allConnections) {
      const conn = JSON.parse(allConnections[connectionId]);
      if (conn.expiredAt < now) {
        await this._deleteConnection(conn.connectionId, conn.workspaceId, conn.userId, conn.channelId);
      } else {
        aliveConnections.push(conn);
      }
    }
    return aliveConnections;
  }

  /**
   * Register new connection in the database
   * @param {string} connectionId Connection id
   * @param {string} workspaceId Workspace id
   * @param {string} userId User id
   * @param {Enum} onlineStatus Online status (online, idle, offline)
   * @param {Object} mediaState Media state object
   * @param {string} timeZone IANA Time zone
   * @returns {object} Connection object
   */
  async connect(
    connectionId,
    workspaceId,
    userId,
    onlineStatus,
    mediaState,
    timeZone
  ) {
    const { apiEventService } = this.server.services();
    const usersConnections = await this.getUserConnections(userId, workspaceId);
    const onlineStatusLifespan = parseInt(process.env.ONLINE_STATUS_LIFESPAN || ONLINE_STATUS_LIFESPAN, 10);

    const connectionObject = {
      connectionId,
      workspaceId,
      userId,
      channelId: null,
      onlineStatus,
      mediaState,
      timeZone,
      expiredAt: Date.now() + onlineStatusLifespan
    };
    await this.setConnectionObject(connectionObject);
    
    // check online status is changed and notify users
    const oldOnlineStatus = this._getMaxOnlineStatus(usersConnections);
    usersConnections.push(connectionObject);
    const newOnlineStatus = this._getMaxOnlineStatus(usersConnections);
    if (oldOnlineStatus !== newOnlineStatus) {
      apiEventService.onlineStatusUpdated(userId, workspaceId, onlineStatus);
    }

    return connectionObject;
  }

  /**
   * Delete connection from the database
   * @param {string} connectionId Connection id
   * @returns {void}
   */
  async disconnect(connectionId) {
    const {
      apiEventService,
      channelService
    } = this.server.services();
    const connection = await this.getConnection(connectionId);

    // check if online status is changed, notify
    let userConnections = await this.getUserConnections(connection.userId);
    const oldOnlineStatus = this._getMaxOnlineStatus(userConnections);
    userConnections = userConnections.filter(conn => conn.connectionId !== connectionId);
    const newOnlineStatus = this._getMaxOnlineStatus(userConnections);
    if (oldOnlineStatus !== newOnlineStatus) {
      apiEventService.onlineStatusUpdated(connection.userId, connection.workspaceId, newOnlineStatus);
    }

    // check if connection was in a channel
    if (connection.channelId) {
      await channelService.unselectChannel(connection.channelId, connection.userId, connectionId);
    }

    await this._deleteConnection(connectionId, connection.workspaceId, connection.userId, connection.channelId);
  }

  /**
   * Update expired date of given connection
   * @param {string} connectionId Connection id
   * @returns {object} Connection object
   */
  async keepConnectionAlive(connectionId) {
    const { client } = this.server.redis;
    const onlineStatusLifespan = parseInt(process.env.ONLINE_STATUS_LIFESPAN || ONLINE_STATUS_LIFESPAN, 10);
    const connectionString = await client.get(redisKeys.connection(connectionId));
    if (!connectionString) return null;
    const connectionObject = JSON.parse(connectionString);
    connectionObject.expiredAt = Date.now() + onlineStatusLifespan;
    await this.setConnectionObject(connectionObject);
    return connectionObject;
  }

  /**
   * Set connection object in the database
   * @param {object} connectionObject Connection object
   * @returns {void}
   */
  async setConnectionObject(connectionObject) {
    const { client } = this.server.redis;
    const connectionId = connectionObject.connectionId;
    const connectionString = JSON.stringify(connectionObject);
    const promiseArray = [
      client.hset(redisKeys.workspace(connectionObject.workspaceId), connectionId, connectionString),
      client.set(redisKeys.connection(connectionId), connectionString),
      client.hset(redisKeys.user(connectionObject.userId), connectionId, connectionString)
    ];
    if (connectionObject.channelId) {
      promiseArray.push(client.hset(redisKeys.channel(connectionObject.channelId), connectionId, connectionString));
    }
    await Promise.all(promiseArray);
  }

  /**
   * Delete specific connection for the channel
   * @param {string} channelId Channel id
   * @param {string} connectionId Connection id
   * @returns {void}
   */
  async deleteConnectionForChannel(channelId, connectionId) {
    const { client } = this.server.redis;
    await client.hdel(redisKeys.channel(channelId), connectionId);
  }
  
  /**
   * Delete connection from the database
   * @param {string} connectionId Connection id
   * @param {string} workspaceId Workspace id
   * @param {string} userId User id
   * @param {string} channelId Channel id
   * @returns {void}
   */
  async _deleteConnection(connectionId, workspaceId, userId, channelId) {
    const { client } = this.server.redis;
    const promiseArray = [
      client.del(redisKeys.connection(connectionId)),
      client.hdel(redisKeys.workspace(workspaceId), connectionId),
      client.hdel(redisKeys.user(userId), connectionId)
    ];
    if (channelId) {
      promiseArray.push(client.hdel(redisKeys.channel(channelId), connectionId));
    }
    await Promise.all(promiseArray);
  }

  /**
   * Get max online status of given connection array
   * @param {Array<object>} connections Connection objects
   * @returns {Enum} Max online status
   */
  _getMaxOnlineStatus(connections) {
    let maxOnlineStatus = 'offline';
    for (let i in connections) {
      if (connections[i].onlineStatus === 'idle' && maxOnlineStatus === 'offline') {
        maxOnlineStatus = 'idle';
      } else if (connections[i].onlineStatus === 'online') {
        maxOnlineStatus = 'online';
      }
    }
    return maxOnlineStatus;
  }
};