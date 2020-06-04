'use strict';

const Schmervice = require('schmervice');
const redisKeys = {
  message: id => `message:${id}`,
};

module.exports = class MessageDatabaseService extends Schmervice.Service {

  constructor (...args) {
    super(...args);
  }

  /**
   * Get message from the database
   * @param {string} messageId Message id
   */
  async getMessage(messageId) {
    const m = await this.server.redis.client.get(redisKeys.message(messageId));
    if (!m) return null;
    return JSON.parse(m);
  }

  /**
   * Save message to the database
   * @param {string} messageId Message id
   * @param {object} data Message data
   */
  async addMessage(messageId, data) {
    await this.server.redis.client.set(redisKeys.message(messageId), JSON.stringify(data));
  }

  /**
   * Delete message from the database
   * @param {string} messageId Message id
   */
  async deleteMessage(messageId) {
    await this.server.redis.client.del(redisKeys.message(messageId));
  }
};
