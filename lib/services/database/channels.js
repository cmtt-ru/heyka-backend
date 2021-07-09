'use strict';

const Schmervice = require('schmervice');
const pgPromise = require('pg-promise')();

const redisKeys = {
  usersInChannel: (id) => `users-in-channel-${id}`,
  channelForUser: (id) => `channel-for-user-${id}`,
  mainSocketForUser: (id) => `main-socket-for-user-${id}`,
  janusOpts: id => `channel:janus:${id}`
};

const ChannelColumnSet = new pgPromise.helpers.ColumnSet([
  'id',
  'name',
  'created_at',
  'updated_at',
  'workspace_id',
  'is_private',
  'is_tmp',
  {
    name: 'user_set',
    def: null
  },
  {
    name: 'description',
    def: null
  },
  {
    name: 'janus',
    def: '{}'
  },
  { name: 'tmp_active_until', def: null },
  'creator_id'
], { table: 'channels' });

const ChannelsMembersColumnSet = new pgPromise.helpers.ColumnSet([
  'workspace_id',
  'user_id',
  'channel_id',
  { name: 'janus_auth_token', def: null },
  { name: 'token_granted_at', def: null },
  { name: 'invite_id', def: null },
  'role'
], { table: 'channels_members'});

module.exports = class ChannelDatabaseService extends Schmervice.Service {

  constructor (...args) {
    super(...args);
  }

  /**
   * Get channel list
   * Returns {array<channel>}
   */
  async getChannelList (){
    const db = this.server.plugins['hapi-pg-promise'].db;

    return db.query('SELECT * FROM channels');
  }

  /**
   * Returns a list with channels roles
   */
  roles () {
    return {
      admin: 'admin',
      moderator: 'moderator',
      user: 'user',
      left: 'left'
    };
  }

  /**
   * Returns temporary channels
   */

  async getTemporaryChannels () {
    const db = this.server.plugins['hapi-pg-promise'].db;
    const q = 'SELECT *  FROM channels WHERE ' +
      'channels.is_private = true AND channels.is_tmp = true';

    return db.query(q);
  }

  /**
   * Returns public channels
   */

  async getPublicChannels () {
    const db = this.server.plugins['hapi-pg-promise'].db;
    const q = 'SELECT *  FROM channels WHERE ' +
      'channels.is_private = false OR null AND channels.is_tmp = false OR null';

    return db.query(q);
  }

  /**
   * Returns private channels
   */

  async getPrivateChannels () {
    const db = this.server.plugins['hapi-pg-promise'].db;
    const q = 'SELECT *  FROM channels WHERE ' +
      'channels.is_private = true AND channels.is_tmp = false OR null';

    return db.query(q);
  }


  /**
   * Returns channel by id
   * @param {string} id Channel id
   */
  async getChannelById(id) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    return db.oneOrNone('SELECT * FROM channels WHERE id=$1', [id]);
  }

  /**
   * Returns channel by user set
   * @param {string} userSet User set (concatenated users id)
   */
  async getChannelsByUserSet(userSet) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    return db.any('SELECT * FROM channels WHERE user_set=$1', [userSet]);
  }

  /**
   * Returns a relation-record between a certain user and a channel
   * @param {string} channelId Channel id
   * @param {string} userId User id
   */
  async getChannelMemberRelation(channelId, userId) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    const query = `
      SELECT * FROM channels_members
      WHERE channel_id=$1 and user_id=$2
    `;
    return await db.oneOrNone(query, [channelId, userId]);
  }

  /**
   * Returns channel record and relation with user
   * @param {string} channelId Channel id
   * @param {string} userId User id
   */
  async getChannelWithRelation(channelId, userId) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    const q = `
      SELECT ch.*, chm.* FROM channels ch
      INNER JOIN channels_members chm ON chm.channel_id = ch.id
      WHERE chm.user_id = $1 AND ch.id = $2
    `;
    return await db.oneOrNone(q, [userId, channelId]);
  }

  /**
   * Returns all users who is joined to the channel
   * @param {string} channelId Channel id
   */
  async getAllChannelMembers(channelId) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    const q = `
      SELECT u.*,chm.role channel_role FROM users u 
      INNER JOIN channels_members chm ON chm.user_id = u.id
      WHERE chm.channel_id = $1 and role!=$2
    `;
    return await db.any(q, [channelId, this.roles().left]);
  }

  /**
   * Returns all channel members with workspace roles
   * @param {string} channelId Channel id
   */
  async getChannelMembersWithWorkspaceRoles(channelId) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    const q = `
      SELECT u.*,wm.role workspace_role,chm.role channel_role FROM channels_members chm 
      INNER JOIN users u ON chm.user_id = u.id
      INNER JOIN workspaces_members wm ON wm.workspace_id = chm.workspace_id AND wm.user_id = chm.user_id
      WHERE chm.channel_id = $1 and chm.role!=$2
    `;
    return await db.any(q, [channelId, this.roles().left]);
  }

  /**
   * Insert channel to the database
   * @param {object} info Channel info
   */
  async insertChannel (info) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    const query = pgPromise.helpers.insert(info, ChannelColumnSet);
    await db.none(query);
  }

  /**
   * Updates channel in database
   * @param {string} id Channel id
   * @param {object} info Update info
   * @returns {object} channel info
   */
  async updateChannel (id, info) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    const updateChannelQuery = pgPromise.helpers.update(info, null, 'channels') 
      + pgPromise.as.format(' WHERE id=$1', id);
    return (await db.query(updateChannelQuery + ' RETURNING *'))[0];
  }

  /**
   * Deletes all channels with that id
   * @param {string} channelId Channel id
   */
  async deleteChannel(channelId) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    const query = `DELETE FROM channels WHERE id=$1`;
    await db.none(query, [channelId]);
  }

  /**
   * Add record to the table with channel-member relation
   * @param {object | array} relation Object\array of object with relation info
   */
  async addChannelMembers (relation) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    const query = pgPromise.helpers.insert(relation, ChannelsMembersColumnSet);
    await db.none(query);
  }

  async deleteChannelMember(channelId, userId) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    const query = `
      DELETE FROM channels_members
      WHERE channel_id=$1 AND user_id=$2
    `;
    await db.none(query, [channelId, userId]);
  }

  /**
   * Updates user-channel relation by user_id and channel_id
   * @param {string} channelId Channel id
   * @param {string} userId User id
   * @param {object} update Update object
   */
  async updateChannelMemberRelation(channelId, userId, update) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    const query = pgPromise.helpers.update(update, null, 'channels_members')
      + pgPromise.as.format(' WHERE channel_id=$1 and user_id=$2', [
        channelId,
        userId
      ]);
    + ' RETURNING *';
    await db.none(query);
  }

  /**
   * Removes user from the previous channel
   * and adds user to the next channel
   * Returns previous channel id
   * @param {string} newChannelId channel
   * @param {string} userId user
   * @returns {string} Previous channel id
   */
  async switchUserToChannel(newChannelId, userId, socketId) {
    const { client } = this.server.redis;
    const [
      oldChannelId,
      oldSocketId
    ] = await Promise.all([
      client.get(redisKeys.channelForUser(userId)),
      client.get(redisKeys.mainSocketForUser(userId))
    ]);

    // modify the old channel list
    if (oldChannelId) {
      const newListForOldChannel = [];
      const oldList = await client.smembers(redisKeys.usersInChannel(oldChannelId));
      for (let i = 0; i < oldList.length; ++i) {
        if (oldList[i] !== userId) newListForOldChannel.push(oldList[i]);
      }
      await client.del(redisKeys.usersInChannel(oldChannelId));
      if (newListForOldChannel.length > 0) {
        await client.sadd(redisKeys.usersInChannel(oldChannelId), newListForOldChannel);
      }
    }

    // modify new channel list
    await Promise.all([
      client.sadd(redisKeys.usersInChannel(newChannelId), userId),
      client.set(redisKeys.channelForUser(userId), newChannelId),
      client.set(redisKeys.mainSocketForUser(userId), socketId),
    ]);
    
    return { oldSocketId, oldChannelId };
  }

  /**
   * Removes user from the current channel
   * @param {string} userId user
   * @returns {array} Users in channel after removing
   */
  async removeUserFromChannel(userId) {
    const { client } = this.server.redis;
    const channelId = await client.get(redisKeys.channelForUser(userId));
    if (!channelId) return;
    await client.del(redisKeys.channelForUser(userId));
    const users = await client.smembers(redisKeys.usersInChannel(channelId));
    if (!users || users.length === 0) return;
    const newList = [];
    for (let i = 0; i < users.length; i++) {
      if (users[i] !== userId) newList.push(users[i]);
    }
    await client.del(redisKeys.usersInChannel(channelId));
    if (newList.length > 0) {
      await client.sadd(redisKeys.usersInChannel(channelId), newList);
    }
    return newList;
  }

  /**
   * Returns list of user id which are in the channel
   * @param {string} channelId channel
   * @returns {array} user id list
   */
  async getAllUsersInChannel(channelId) {
    const { client } = this.server.redis;
    const list = await client.smembers(redisKeys.usersInChannel(channelId));
    return list || [];
  }

  /**
   * Returns channel id which the user has selected earlier 
   * @param {string} userId user
   * @returns {string} channel id
   */
  async getChannelByUserId(userId) {
    const { client } = this.server.redis;
    return await client.get(redisKeys.channelForUser(userId));
  }
  
  /**
   * Returns main socket for the user
   * @param {string} userId User id
   */
  async getMainSocketForUser(userId) {
    const { client } = this.server.redis;
    return await client.get(redisKeys.mainSocketForUser(userId));
  }

  /**
   * Get janus parameters for channel
   * @param {string} channelId Channel id
   * @returns {?object} Janus parameters or null
   */
  async getJanusForChannel(channelId) {
    const { client } = this.server.redis;
    const janusOpts = await client.get(redisKeys.janusOpts(channelId));
    if (!janusOpts) return null;
    return JSON.parse(janusOpts);
  }

  /**
   * Set janus parameters for channel
   * @param {string} channelId Channel id
   * @param {object} opts Janus opts
   * @returns {void}
   */
  async setJanusForChannel(channelId, opts) {
    const { client } = this.server.redis;
    const janusOpts = JSON.stringify(opts);
    await client.set(redisKeys.janusOpts(channelId), janusOpts);
  }

  /**
   * Deletes janus parameters for channel
   * @param {string} channelId Channel id
   * @returns {void}
   */
  async deleteJanusForChannel(channelId) {
    const { client } = this.server.redis;
    await client.del(redisKeys.janusOpts(channelId));
  }
};
