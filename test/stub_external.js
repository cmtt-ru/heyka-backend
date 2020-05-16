'use strict';

const mockery = require('mockery');
const sinon = require('sinon');
const path = require('path');
const Schmervice = require('schmervice');

// Stubbed methods to check external services
const stubbedMethods = {
  sendEmail: sinon.stub(),
  sendEmailWithInvite: sinon.stub(),

  addAuthTokenForWorkspace: sinon.stub(),
  deleteAuthTokenForWorkspace: sinon.stub(),
  manageAuthTokensForChannel: sinon.stub(),
  createAudioVideoRooms: sinon.stub(),
  deleteAudioVideoRooms: sinon.stub(),
  createServer: sinon.stub(),

  sendInviteToWorkspaceBySlack: sinon.stub(),
  getConnectingSlackUrl: sinon.stub(),

  uploadImageFromUrl: sinon.stub(),
};

// mock services that make requests to external APIs
const pathToEmailService = path.resolve(__dirname, '../lib/services/email.js');
const pathToJanusService = path.resolve(__dirname, '../lib/services/janus_workspace.js');
const pathToSlackService = path.resolve(__dirname, '../lib/services/slack.js');
const pathToFileService = path.resolve(__dirname, '../lib/services/file.js');
mockery.enable({
  warnOnReplace: true,
  warnOnUnregistered: false // disable warnings on unmocked modules
});
mockery.registerMock(
  pathToJanusService,
  class JanusWorkspaceService extends Schmervice.Service {
    initJanusNodes() {}
    createServer() {
      stubbedMethods.createServer(arguments);
      return { url: 'http://192.168.0.13:8088' };
    }
    createAudioVideoRooms() {
      stubbedMethods.createAudioVideoRooms(arguments);
      return { audioRoomId: 5512318512, videoRoomId: 8412851923 };
    }
    deleteAudioVideoRooms() {
      stubbedMethods.deleteAudioVideoRooms(arguments);
    }
    addAuthTokenForWorkspace() {
      stubbedMethods.addAuthTokenForWorkspace(arguments);
    }
    deleteAuthTokenForWorkspace() {
      stubbedMethods.deleteAuthTokenForWorkspace(arguments);
    }
    manageAuthTokensForChannel () {
      stubbedMethods.manageAuthTokensForChannel(arguments);
    }
  }
);
mockery.registerMock(
  pathToEmailService,
  class EmailService extends Schmervice.Service {
    sendEmailVerificationCode() {
      stubbedMethods.sendEmail(arguments);
    }
    sendInviteToWorkspace() {
      stubbedMethods.sendEmailWithInvite(arguments);
    }
  }
);
mockery.registerMock(
  pathToSlackService,
  class SlackService extends Schmervice.Service {
    sendInviteToWorkspace() {
      stubbedMethods.sendInviteToWorkspaceBySlack(arguments);
    }
    getConnectingSlackUrl() {
      stubbedMethods.getConnectingSlackUrl(arguments);
      return `http://slack.com/connect`;
    }
    gainAccessTokenByOAuthCode() {
      return {};
    }
  }
);
mockery.registerMock(
  pathToFileService,
  class FileService extends Schmervice.Service {
    upload() {
      return 'https://leonardo.osnova.io/794af87c-195d-c9ee-40d6-14131c4c43a6/';
    }
    uploadImageFromUrl() {
      stubbedMethods.uploadImageFromUrl(...arguments);
      return 'https://leonardo.osnova.io/794af87c-195d-c9ee-40d6-14131c4c43a6/';
    }
  }
);

exports.methods = stubbedMethods;
