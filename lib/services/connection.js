'use strict';

const Schmervice = require('schmervice');
const redisKeys = {
  workspace: id => `workspace:${id}`,
  user: id => `user:${id}`,
  channel: id => `channel:${id}`,
  connection: id => `connection:${id}`,
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
      if (conn.expiredAt > now) {
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
   * Get all user's connections for workspace
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
      if (conn.expiredAt > now) {
        aliveConnections.push(conn);
      }
    }
    return aliveConnections;
  }

  /**
   * Get all user's connections
   * @param {string} userId User id
   * @param {string} workspaceId Workspace id
   * @returns {Array<Object>} Array of users connections
   */
  async getAllUserConnections(userId) {
    const { client } = this.server.redis;
    const allConnections = await client.hgetall(redisKeys.user(userId));
    const aliveConnections = [];
    const now = Date.now();
    for (let connectionId in allConnections) {
      const conn = JSON.parse(allConnections[connectionId]);
      if (conn.expiredAt > now) {
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
      if (conn.expiredAt > now) {
        aliveConnections.push(conn);
      }
    }
    return aliveConnections;
  }

  /**
   * Is user in channel
   * 
   * @param {string} workspaceId Workspace id
   * @param {string} userId User id
   * @param {string} channelId Channel id
   * @returns {boolean} True - user in channel / False - user is not in channel
   */
  async isUserInChannel(workspaceId, userId, channelId) {
    let inChannel = false;
    const conns = await this.getUserConnections(userId, workspaceId);
    for (let i in conns) {
      if (conns[i].channelId === channelId) {
        inChannel = true;
        break;
      }
    }
    return inChannel;
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
    const {
      apiEventService,
      workspaceDatabaseService: wdb,
      userDatabaseService: udb,
    } = this.server.services();
    const redlock = this.server.plugins['hapi-redlock-plugin'].redlock;

    const lock = await redlock.lock(`user-connections-${userId}`, 500);
    const start = Date.now();

    const onlineStatusLifespan = parseInt(process.env.ONLINE_STATUS_LIFESPAN || ONLINE_STATUS_LIFESPAN, 10);

    const connectionObject = {
      connectionId,
      workspaceId,
      userId,
      channelId: null,
      mediaState,
      timeZone,
      expiredAt: Date.now() + onlineStatusLifespan
    };
    await this.setConnectionObject(connectionObject);
    
    // check online status is changed and notify users
    const user = await udb.findById(userId);
    let newOnlineStatus = null;
    if (!user.online_status || user.online_status === 'sleep') {
      newOnlineStatus = onlineStatus;
    }
    
    if (newOnlineStatus) {
      await udb.updateUser(userId, { online_status: newOnlineStatus });
      const workspaces = await wdb.getWorkspacesByUserId(userId);
      workspaces.forEach(w => apiEventService.onlineStatusUpdated(userId, w.id, newOnlineStatus));
    }

    try {
      await lock.unlock();
    } catch (e) {
      console.error(`Error on unlock resource (${Date.now() - start}ms): `, e);
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
      channelService,
      workspaceDatabaseService: wdb,
      userDatabaseService: udb,
    } = this.server.services();
    const redlock = this.server.plugins['hapi-redlock-plugin'].redlock;

    const connection = await this.getConnection(connectionId);
    console.log(`[${connectionId}]: Try to disconnect sessions ${!!connection}`);

    if (!connection) {
      // user is already disconnected, ignore
      return;
    }
    
    const lock = await redlock.lock(`user-connections-${connection.userId}`, 500);
    const start = Date.now();

    // check if online status is changed, notify
    const conns = (await this.getAllUserConnections(connection.userId))
      .filter(c => c.connectionId !== connectionId);
    const user = await udb.findById(connection.userId);

    if (!user) {
      return;
    }

    const newOnlineStatus = this.getMaxOnlineStatus(conns, user.online_status);
    if (newOnlineStatus !== user.online_status) {
      await udb.updateUser(connection.userId, { online_status: newOnlineStatus });
      const workspaces = await wdb.getWorkspacesByUserId(connection.userId);
      workspaces.forEach(w => apiEventService.onlineStatusUpdated(connection.userId, w.id, newOnlineStatus));
    }

    // check if connection was in a channel
    if (connection.channelId) {
      try {
        await channelService.unselectChannel(connection.channelId, connection.userId, connectionId);
      } catch(e) {
        if (e.message === 'ChannelAlreadyDeleted') {
          // ignore the error
          // we try disconnect socket, so channel might be already deleted, it's ok
        } else {
          throw e;
        }
      }
    }

    await this._deleteConnection(connectionId, connection.workspaceId, connection.userId, connection.channelId);
    
    try {
      await lock.unlock();
    } catch (e) {
      console.error(`Error on unlock resource (${Date.now() - start}ms): `, e);
    }

    return true;
  }

  /**
   * Update expired date of given connection
   * @param {string} connectionId Connection id
   * @param {number} lifespan
   * @returns {object} Connection object
   */
  async keepConnectionAlive(connectionId, lifespan) {
    const { client } = this.server.redis;
    const onlineStatusLifespan = lifespan || parseInt(process.env.ONLINE_STATUS_LIFESPAN || ONLINE_STATUS_LIFESPAN, 10);
    const connectionString = await client.get(redisKeys.connection(connectionId));
    if (!connectionString) return null;
    const connectionObject = JSON.parse(connectionString);
    connectionObject.expiredAt = Date.now() + onlineStatusLifespan;
    await this.setConnectionObject(connectionObject);
    return connectionObject;
  }

  /**
   * Migrate previous connection to new name 
   * @param {string} prevConnectionId Previous connection id
   * @param {string} newConnectionId New connection id
   */
  async renameConnection(prevConnectionId, newConnectionId) {
    const conn = await this.getConnection(prevConnectionId);
    console.log(`[${prevConnectionId}, ${newConnectionId}]: Try to disconnect sessions ${!!conn}`);
    if (!conn) return null;
    const onlineStatusLifespan = parseInt(process.env.ONLINE_STATUS_LIFESPAN || ONLINE_STATUS_LIFESPAN, 10);
    conn.expiredAt = Date.now() + onlineStatusLifespan;
    conn.connectionId = newConnectionId;
    await Promise.all([
      this.setConnectionObject(conn),
      this._deleteConnection(prevConnectionId, conn.workspaceId, conn.userId, conn.channelId)
    ]);
    return conn;
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
   * @param {String} currentOnlineStatus
   * @returns {Enum} Max online status
   */
  getMaxOnlineStatus(connections, currentOnlineStatus = null) {
    if (connections.length === 0) {
      return null;
    }

    if (currentOnlineStatus === 'idle' || currentOnlineStatus === 'offline') {
      return currentOnlineStatus;
    }

    const sleepConns = connections.reduce((prev, curr) => curr.onlineStatus === 'sleep' ? prev + 1 : prev, 0);
    if (sleepConns === connections.length) {
      return 'sleep';
    }

    return 'online';
  }
};
