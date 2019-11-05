'use strict';

const Schmervice = require('schmervice');
const uuid4 = require('uuid/v4');

module.exports = class UserService extends Schmervice.Service {

  constructor (...args) {
    super(...args);
  }

  async findByEmail (email) {
    const users = await this.redis.client.keys(`user:*`);
    return users.map(user => JSON.parse(user)).find(user => user.email === email);
  }

  async signup (userInfo) {
    let user = await this.findByEmail(userInfo.email);
    if (user) throw new Error('EmailExists');
    const id = uuid4();
    user = { id, ...userInfo };
    await this.redis.client.set(`user:${id}`, JSON.stringify(user));
    return user;
  }
};
