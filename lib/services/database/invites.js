'use strict';

const Schmervice = require('schmervice');
const pgPromise = require('pg-promise')();

const ChannelColumnSet = new pgPromise.helpers.ColumnSet([
  'id',
  'created_by',
  'workspace_id',
  'code',
  'created_at',
  'updated_at',
  'expired_at'
], { table: 'invites' });

module.exports = class InviteCodesDatabaseService extends Schmervice.Service {

  constructor (...args) {
    super(...args);
  }

  /**
   * Insert invite to the database
   * @param {object} info Invite info
   */
  async insertInvite (info) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    const query = pgPromise.helpers.insert(info, ChannelColumnSet);
    await db.none(query);
  }
};
