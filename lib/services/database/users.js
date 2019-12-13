'use strict';

const Schmervice = require('schmervice');
const uuid4 = require('uuid/v4');

module.exports = class UserDatabaseService extends Schmervice.Service {

  constructor (...args) {
    super(...args);
  }

  /**
   * Finds user in database
   * @param {uuid} id User id
   * @returns {?object} Found user
   */
  async findById (id) {
    const db = this.server.plugins['hapi-pg-promise'].db;
    return await db.oneOrNone('SELECT * FROM users WHERE id=$1', id);
  }
};
