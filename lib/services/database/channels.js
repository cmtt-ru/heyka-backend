'use strict';

const Schmervice = require('schmervice');
const pgPromise = require('pg-promise')();

const ChannelColumnSet = new pgPromise.helpers.ColumnSet([
  'id',
  'name',
  'created_at',
  'updated_at',
  'workspace_id',
  'is_private',
  { name: 'tmp_active_until', def: null },
  'creator_id'
], { table: 'channels' });

const ChannelsMembersColumnSet = new pgPromise.helpers.ColumnSet([
  'workspace_id',
  'user_id',
  'channel_id',
  'role'
], { table: 'channels_members'});

module.exports = class ChannelDatabaseService extends Schmervice.Service {

  constructor (...args) {
    super(...args);
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
   * Insert channel to the database
   * @param {object} info Channel info
   */
  async insertChannel (info) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    const query = pgPromise.helpers.insert(info, ChannelColumnSet);
    await db.none(query);
  }

  /**
   * Add record to the table with channel-member relation
   * @param {object | array} relations Object\array of object with relation info
   */
  async addChannelMembers (relation) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    const query = pgPromise.helpers.insert(relation, ChannelsMembersColumnSet);
    await db.none(query);
  }
};
