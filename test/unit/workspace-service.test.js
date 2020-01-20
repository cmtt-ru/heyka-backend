'use strict';

const Lab = require('@hapi/lab');
const { describe, it, before } = exports.lab = Lab.script();
const { expect } = require('@hapi/code');
const WorkspaceService = require('../../lib/services/workspace');
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

describe('Unit tests: workspaceService', () => {
  let workspaceService = null;

  before(() => {
    workspaceService = new WorkspaceService();
  });
  
  describe('createWorkspace', () => {
    it('works without errors', async () => {
      const user = { id: 'userUUID' };
      const janusWorkspaceService = {
        createServer: sinon.stub().resolves('janus-info-JSON')
      };
      const workspaceDatabaseService = {
        roles: () => ({}),
        insertWorkspace: sinon.stub().resolves(true),
        addWorkspaceMember: sinon.stub().resolves(true),
        updateWorkspace: sinon.stub().resolves({ created: true })
      };
      const channelService = {
        createDefaultChannels: sinon.stub().resolves(true)
      };
      await workspaceService.createWorkspace.call(
        stubServices(
          'janusWorkspaceService', 
          janusWorkspaceService,
          'workspaceDatabaseService',
          workspaceDatabaseService,
          'channelService',
          channelService
        ), 
        user, 
        'workspaceName');
      expect(workspaceDatabaseService.insertWorkspace.calledOnce).true();
      expect(workspaceDatabaseService.addWorkspaceMember.calledOnce).true();
      expect(workspaceDatabaseService.addWorkspaceMember.firstCall.args[0].user_id).equals('userUUID');
      expect(workspaceDatabaseService.updateWorkspace.calledOnce).true();
      expect(workspaceDatabaseService.updateWorkspace.firstCall.args[1]).equals({ janus: 'janus-info-JSON' });
      expect(channelService.createDefaultChannels.calledOnce).true();
    });
  });

  describe('canCreateChannel', () => {
    it('should return "false" if there are no relations', async () => {
      const workspaceDatabaseService = {
        roles: () => ({ admin: 'a', moderator: 'm', user: 'u'}),
        getUserWorkspaceRelations: sinon.stub().resolves([])
      };
      const result = await workspaceService.canCreateChannel.call(
        stubServices('workspaceDatabaseService', workspaceDatabaseService), 
        user, 
        'workspaceName');
      expect(result).to.equal(false);
    });
    it('should return "false" if the relation is not admin\moderator', async () => {
      const workspaceDatabaseService = {
        roles: () => ({ admin: 'a', moderator: 'm', user: 'u'}),
        getUserWorkspaceRelations: sinon.stub().resolves([{ role: 'u' }])
      };
      const result = await workspaceService.canCreateChannel.call(
        stubServices('workspaceDatabaseService', workspaceDatabaseService), 
        user, 
        'workspaceName');
      expect(result).to.equal(false);
    });
    it('should return "true" if the relation is admin\moderator', async () => {
      const workspaceDatabaseService = {
        roles: () => ({ admin: 'a', moderator: 'm', user: 'u'}),
        getUserWorkspaceRelations: sinon.stub().resolves([{ role: 'a' }])
      };
      const result = await workspaceService.canCreateChannel.call(
        stubServices('workspaceDatabaseService', workspaceDatabaseService), 
        user, 
        'workspaceName');
      expect(result).to.equal(true);
    });
  })
});
