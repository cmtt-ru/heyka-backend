'use strict';

const Schmervice = require('schmervice');
const uuid4 = require('uuid/v4');

module.exports = class JanusWorkspaceService extends Schmervice.Service {

  constructor (...args) {
    super(...args);
  }

  /**
   * Send request for creating janus server and returns id and url of it
   * @returns {object} Object with an external id and url of the created Janus server
   */
  async createServer () {
    return {
      id: uuid4(),
      url: 'http://127.0.0.1'
    };
  }
};
