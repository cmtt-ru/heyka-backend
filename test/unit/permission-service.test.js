'use strict';

const Lab = require('@hapi/lab');
const { describe, it, before } = exports.lab = Lab.script();
const { expect } = require('@hapi/code');
const PermissionService = require('../../lib/services/permission');
const sinon = require('sinon');

const stubServices = (...args) => {
  return {
    server: {
      services () {
        const resultObject = {};
        for (let i = 0; i < args.length-1; ++i) {
          if (i % 2 !== 0) continue;
          resultObject[args[i]] = args[i+1];
        }
        return resultObject;
      }
    }
  };
};
describe('Unit tests: permissionService', () => {
  let permissionService = null;

  before(() => {
    permissionService = new PermissionService();
  });

  describe('canCreateChannel', () => {
    it('should return "false" if there are no relations', async () => {
      const workspaceDatabaseService = {
        roles: () => ({ admin: 'a', moderator: 'm', user: 'u'}),
        getUserWorkspaceRelations: sinon.stub().resolves([])
      };
      const result = await permissionService.canCreateChannelWorkspace.call(
        stubServices('workspaceDatabaseService', workspaceDatabaseService), 
        'workspaceId', 
        'userId');
      expect(result).to.equal(false);
    });
    it('should return "false" if the relation is not admin\\moderator\\user', async () => {
      const workspaceDatabaseService = {
        roles: () => ({ admin: 'a', moderator: 'm', user: 'u', guest: 'g' }),
        getUserWorkspaceRelations: sinon.stub().resolves([{ role: 'g' }])
      };
      const result = await permissionService.canCreateChannelWorkspace.call(
        stubServices('workspaceDatabaseService', workspaceDatabaseService), 
        'workspaceId', 
        'userId');
      expect(result).to.equal(false);
    });
    it('should return "true" if the relation is admin\\moderator\\user', async () => {
      const workspaceDatabaseService = {
        roles: () => ({ admin: 'a', moderator: 'm', user: 'u'}),
        getUserWorkspaceRelations: sinon.stub().resolves([{ role: 'a' }])
      };
      const result = await permissionService.canCreateChannelWorkspace.call(
        stubServices('workspaceDatabaseService', workspaceDatabaseService), 
        'workspaceId', 
        'userId');
      expect(result).to.equal(true);
    });
  });
});
