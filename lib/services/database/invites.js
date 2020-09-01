'use strict';

const Schmervice = require('schmervice');
const pgPromise = require('pg-promise')();

const ChannelColumnSet = new pgPromise.helpers.ColumnSet([
  'id',
  'created_by',
  'workspace_id',
  {
    name: 'channel_id',
    def: null,
  },
  {
    name: 'type',
    def: null,
  },
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
   * Return invite code from the database
   * @param {string} id Id of invite code
   */
  async getInviteById(id) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    return db.oneOrNone('SELECT * FROM invites WHERE id=$1', id);
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

  /**
   * Deletes invite code from the database
   * @param {string} id Verification code id
   */
  async deleteInviteCode(id) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    return db.none('DELETE FROM invites WHERE id=$1', [id]);
  }
};
