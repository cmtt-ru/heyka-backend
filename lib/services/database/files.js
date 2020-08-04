'use strict';

const Schmervice = require('schmervice');
const pgPromise = require('pg-promise')();

const FileColumnSet = new pgPromise.helpers.ColumnSet([
  'id',
  'filename',
  'user_id',
  'created_at',
  'updated_at',
], { table: 'files' });

module.exports = class FilesDatabaseService extends Schmervice.Service {

  constructor (...args) {
    super(...args);
  }

  /**
   * Finds file in database
   * @param {string} id File id
   */
  async getFileById(id) {
    const db = this.server.plugins['hapi-pg-promise'];
    return db.oneOrNone('SELECT * from files WHERE id=$1', [id]);
  }

  /**
   * Return user files which are uploaded for last 24 hours
   * @param {string} userId User id
   * @param {Date} time Timestamp
   */
  async getUserFilesUploadedAfter(userId, date) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    return db.any('SELECT * FROM files WHERE user_id=$1 AND created_at > $2', [userId, date]);
  }

  /**
   * Insert file to the database
   * @param {object} info File info
   */
  async insertFile(info) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    const query = pgPromise.helpers.insert(info, FileColumnSet);
    await db.none(query);
  }
};
