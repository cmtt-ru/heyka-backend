'use strict';

exports.UserSocketsStorage = class UserSocketsStorage {
  constructor () {
    this.storage = {};
  }

  addSocketForUser (userId, socketId) {
    if (!this.storage[userId]) {
      this.storage[userId] = {};
    }

    this.storage[userId][socketId] = true;
  }

  deleteSocketForUser (userId, socketId) {
    if (!this.storage[userId]) return;
    if (!this.storage[userId][socketId]) return;
    delete this.storage[userId][socketId];
  }

  getUserSockets (userId) {
    if (!this.storage[userId]) return [];
    return Object.keys(this.storage[userId]);
  }
}; 
