'use strict';

const mockery = require('mockery');
const sinon = require('sinon');
const path = require('path');
const Schmervice = require('schmervice');

// Stubbed methods to check external services
const stubbedMethods = {
  sendEmail: sinon.stub(),
  sendEmailWithInvite: sinon.stub(),
  sendResetPasswordToken: sinon.stub(),

  addAuthTokenForWorkspace: sinon.stub(),
  deleteAuthTokenForWorkspace: sinon.stub(),
  manageAuthTokensForChannel: sinon.stub(),
  createAudioVideoRooms: sinon.stub(),
  deleteAudioVideoRooms: sinon.stub(),
  createServer: sinon.stub(),

  sendInviteToWorkspaceBySlack: sinon.stub(),
  getConnectingSlackUrl: sinon.stub(),

  uploadImageFromUrl: sinon.stub(),
  uploadS3FromUrl: sinon.stub(),
};

// mock services that make requests to external APIs
const pathToEmailService = path.resolve(__dirname, '../lib/services/email/email.js');
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
    decrementJanusChannelsFor() {}
    getJanus () {
      return {
        url: 'http://localhost',
        publicHttpsUrl: 'https://localhost',
        publicWssUrl: 'wss://localhost',
        apiPath: 'janus',
        apiPort: 8088,
        publicHttpsPort: 8089,
        publicWssPort: 8989,
        adminPath: 'admin',
        adminPort: 7088,
        adminSecret: 'wowwhattheheck',
        pluginSecrets: {
          audiobridge: 'superse2cret',
          videoroom: 'supersecret'
        }
      };
    }
    createServer() {
      stubbedMethods.createServer(arguments);
      return { url: 'http://192.168.0.13:7088', public_url: 'http://192.168.0.13:8088' };
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
    sendWelcomeMail() {
      stubbedMethods.sendEmail(arguments);
    }
    sendInviteToWorkspace() {
      stubbedMethods.sendEmailWithInvite(arguments);
    }
    sendResetPasswordToken() {
      stubbedMethods.sendResetPasswordToken(arguments);
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
    uploadLeonardo() {
      return 'https://leonardo.osnova.io/794af87c-195d-c9ee-40d6-14131c4c43a6/';
    }
    uploadS3() {
      return '794af87c-195d-c9ee-40d6-14131c4c43a6.png';
    }
    deleteFileS3() {
      return true;
    }
    uploadS3FromUrl() {
      stubbedMethods.uploadS3FromUrl(...arguments);
    }
    getImgproxyImageSet() {
      return {
        image32x32: 'https://l.osn.io/794af87c',
        image64x64: 'https://l.osn.io/794af87c',
        image128x128: 'https://l.osn.io/794af87c'
      };
    }
    getImageSetForOwnedEntity() {
      return {
        image32x32: 'https://l.osn.io/794af87c',
        image64x64: 'https://l.osn.io/794af87c',
        image128x128: 'https://l.osn.io/794af87c'
      };
    }
    uploadImageFromUrl() {
      stubbedMethods.uploadImageFromUrl(...arguments);
      return 'https://leonardo.osnova.io/794af87c-195d-c9ee-40d6-14131c4c43a6/';
    }
  }
);

exports.methods = stubbedMethods;
