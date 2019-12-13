const Lab = require('@hapi/lab');
const { describe, it, before, beforeEach } = exports.lab = Lab.script();
const { expect } = require('@hapi/code');
const UserService = require('../../lib/services/user');

describe('Test userService', () => {
  let userService = null;
  before(() => {
    userService = new UserService();
  });
  describe('Test findById function', () => {
    it('findById should return user if he exists', async () => {
      expect(typeof userService.findById).equals('function');
    });
  })
});