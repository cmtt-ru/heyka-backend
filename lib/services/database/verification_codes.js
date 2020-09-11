'use strict';

const Schmervice = require('schmervice');
const pgPromise = require('pg-promise')();

const ChannelColumnSet = new pgPromise.helpers.ColumnSet([
  'id',
  'user_id',
  'email',
  'code',
  'created_at',
  'updated_at',
  'expired_at'
], { table: 'verification_codes' });

module.exports = class VerificationCodesDatabaseService extends Schmervice.Service {

  constructor (...args) {
    super(...args);
  }

  /**
   * Return verification code from the database
   * @param {string} id Id of invite code
   */
  async getVerificationCodeById(id) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    return db.oneOrNone('SELECT * FROM verification_codes WHERE id=$1', [id]);
  }

  /**
   * Insert veritication to the database
   * @param {object} info Invite info
   */
  async insertVerificationCode (info) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    const query = pgPromise.helpers.insert(info, ChannelColumnSet);
    await db.none(query);
  }

  /**
   * Deletes verification code from the database
   * @param {string} id Verification code id
   */
  async deleteVerificationCode(id) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    return db.none('DELETE FROM verification_codes WHERE id=$1', [id]);
  }

  /**
   * Deletes all verification codes from the database by userId
   * @param {string} userId User id
   */
  async deleteAllVerificationCodes(userId) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    return db.none('DELETE FROM verification_codes WHERE user_id=$1', [userId]);
  }
};
