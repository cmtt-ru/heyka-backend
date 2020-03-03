'use strict';

const Schmervice = require('schmervice');
const pgPromise = require('pg-promise')();

const AuthLinkColumnSet = new pgPromise.helpers.ColumnSet([
  'id',
  'user_id',
  'code',
  'created_at',
  'updated_at',
  'expired_at'
], { table: 'auth_links' });

module.exports = class AuthLinksDatabaseService extends Schmervice.Service {

  constructor (...args) {
    super(...args);
  }

  /**
   * Return auth link from the database
   * @param {string} id Id of auth link
   */
  async getAuthLinkById(id) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    return db.oneOrNone('SELECT * FROM auth_links WHERE id=$1', [id]);
  }

  /**
   * Insert auth link to the database
   * @param {object} info auth link info
   */
  async insertAuthLink (info) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    const query = pgPromise.helpers.insert(info, AuthLinkColumnSet);
    await db.none(query);
  }

  /**
   * Deletes auth from the database
   * @param {string} id auth link id
   */
  async deleteVerificationCode(id) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    return db.none('DELETE FROM auth_links WHERE id=$1', [id]);
  }
};
