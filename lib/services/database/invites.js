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
   * Return invite object from the database
   * @param {string} code Code of invite
   */
  async getInviteByCode(code) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    return db.oneOrNone('SELECT * FROM invites WHERE code=$1', code);
  }

  /**
   * Return invite object from the database
   * @param {string} id id of invite code
   */
  async getInviteById(id) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    return db.oneOrNone('SELECT * FROM invites WHERE id=$1', id);
  }

  /**
   * Return invites to specific workspace by the user
   * @param {string} workspaceId Workspace id
   * @param {string} userId User id
   */
  async getInvitesByWorkspaceAndUser(workspaceId, userId) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    return db.any('SELECT * FROM invites WHERE workspace_id=$1 AND created_by=$2', [workspaceId, userId]);
  }

  /**
   * Return all workspace invites
   * @param {string} workspaceId Workspace id
   */
  async getInvitesByWorkspace(workspaceId) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    return db.any('SELECT * FROM invites WHERE workspace_id=$1', [workspaceId]);
  }

  /**
   * Return all channel invites
   * @param {string} channelId Channel id
   * @param {string} type Invite type
   */
  async getInvitesByChannel(channelId, type = null) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    if (type) {
      return db.any('SELECT * FROM invites WHERE channel_id=$1 AND type=$2', [channelId, type]);
    } else {
      return db.any('SELECT * FROM invites WHERE channel_id=$1', [channelId]);
    }
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

  /**
   * Delete all channel invites
   * @param {string} channelId Channel id
   * @param {string} type Invite type
   */
  async deleteInvitesByChannel(channelId, type = null) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    if (type) {
      return db.any('DELETE FROM invites WHERE channel_id=$1 AND type=$2', [channelId, type]);
    } else {
      return db.any('DELETE FROM invites WHERE channel_id=$1', [channelId]);
    }
  }
};
