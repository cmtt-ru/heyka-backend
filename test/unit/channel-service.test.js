'use strict';

const Lab = require('@hapi/lab');
const { describe, it, before } = exports.lab = Lab.script();
const { expect } = require('@hapi/code');
const ChannelService = require('../../lib/services/channel');
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

describe('Unit tests: channelService', () => {
  let channelService = null;

  before(() => {
    channelService = new ChannelService();
  });

  describe('createDefaultChannels', () => {
    it('works without errors', async () => {
      const user = { id: 'userUUID' };
      const workspace = { id: 'workspaceUUID', janus: {} };
      const channelDatabaseService = {
        insertChannel: sinon.stub().resolves(true),
        addChannelMembers: sinon.stub().resolves(true),
        roles: () => ({ admin: 'admin' })
      };
      const janusWorkspaceServiceStub = {
        createAudioVideoRooms: sinon.stub().resolves({}),
        manageAuthTokensForChannel: sinon.stub().resolves({})

      };
      await channelService.createDefaultChannels.call(
        stubServices(
          'channelDatabaseService', 
          channelDatabaseService,
          'janusWorkspaceService',
          janusWorkspaceServiceStub
        ), 
        user, 
        workspace);
      
      // check if the channel was created properly
      expect(channelDatabaseService.insertChannel.calledOnce).true();
      expect(channelDatabaseService.insertChannel.firstCall.args[0].creator_id).equals(user.id);
      expect(channelDatabaseService.insertChannel.firstCall.args[0].workspace_id).equals(workspace.id);

      // check channel - memeber relation
      expect(channelDatabaseService.addChannelMembers.calledOnce).true();
      expect(channelDatabaseService.addChannelMembers.firstCall.args[0].workspace_id).equals(workspace.id);
      expect(channelDatabaseService.addChannelMembers.firstCall.args[0].user_id).equals(user.id);
      expect(channelDatabaseService.addChannelMembers.firstCall.args[0].role)
        .equals(channelDatabaseService.roles().admin);
      expect(channelDatabaseService.addChannelMembers.firstCall.args[0].channel_id)
        .equals(channelDatabaseService.insertChannel.firstCall.args[0].id);
    });
  });
});
