'use strict';

const Schmervice = require('schmervice');
const pgPromise = require('pg-promise')();

const MessageColumnSet = new pgPromise.helpers.ColumnSet([
  'id',
  'from_user_id',
  'to_user_id',
  'workspace_id',
  'channel_id',
  'updated_at',
  'created_at',
  {
    name: 'data',
    def: '{}',
    mod: ':json'
  }
], { table: 'messages' });

module.exports = class MessageDatabaseService extends Schmervice.Service {

  constructor (...args) {
    super(...args);
  }

  /**
   * Get message from the database
   * @param {string} messageId Message id
   */
  async getMessage(messageId) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    return db.oneOrNone('SELECT * FROM messages WHERE id=$1', [messageId]);
  }

  /**
   * Save message to the database
   * @param {object} messageInfo Push info object
   */
  async addMessage(messageInfo) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    const query = pgPromise.helpers.insert(messageInfo, MessageColumnSet);
    await db.none(query);
  }

  /**
   * Delete message from the database
   * @param {string} messageId Message id
   */
  async deleteMessage(messageId) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    const query = `DELETE FROM messages WHERE id=$1`;
    await db.none(query, [messageId]);
  }
};
