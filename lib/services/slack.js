'use strict';

const Schmervice = require('schmervice');
const { WebClient } = require('@slack/web-api');
const config = require('../../config');
const SLACK_CLIENT_ID = config.credentials.slack.clientId;
const SLACK_CLIENT_SECRET = config.credentials.slack.clientSecret;
const CONNECTING_REDIRECT_PATH = '/workspaces/slack/connect/resume';
const JOIN_BY_INVITE_PATH = '/join/';

module.exports = class SlackService extends Schmervice.Service {

  constructor (...args) {
    super(...args);
    this.slack = new WebClient();
  }

  /**
   * Sends invite code by slack
   * @param {string} fromId User sender (Slack id)
   * @param {string} token Slack access token
   * @param {string} toId User receiver (Slack id)
   * @param {string} workspaceName Workspace name
   * @param {string} fullCode Invite code
   */
  async sendInviteToWorkspace (fromId, token, toId, workspaceName, fullCode) {
    // read all conversations. If there is created one, use it.
    const url = this.server.info.uri
      + JOIN_BY_INVITE_PATH
      + fullCode;
    try {
      let createResponse = await this.slack.im.open({
        token,
        user: toId
      });
      const channelId = createResponse.channel.id;
      await this.slack.chat.postMessage({
        token,
        channel: channelId,
        text: `<@${fromId}> invited you `
          + `to *${workspaceName}* workspace in Heyka. <${url}|Join!>`
      });
    } catch(e) {
      throw new Error(e);
    }
  }

  /**
   * Returns link that user should follow to connect our slack app to
   * his workspace.
   * @param {string} slackState Slack state (operation id)
   */
  async getConnectingSlackUrl(slackState) {
    const redirectUri = this.server.info.uri +
      CONNECTING_REDIRECT_PATH;

    const permissionScopes = [
      'groups:read',
      'groups:write',
      'im:read',
      'im:write',
      'users:read',
      'chat:write'
    ];

    return `https://slack.com/`
      + `oauth/v2/authorize`
      + `?scope=${decodeURI(permissionScopes.join(','))}`
      + `&client_id=${SLACK_CLIENT_ID}`
      + `&state=${slackState}`
      + `&redirect_uri=${encodeURI(redirectUri)}`;
  }

  /**
   * Exchanges OAuth slack code to a permanent access token
   * @param {string} code OAuth code that has been returned from Slack
   */
  async gainAccessTokenByOAuthCode(code) {
    const redirectUri = this.server.info.uri +
      CONNECTING_REDIRECT_PATH;

    const response = await this.slack.oauth.v2.access({
      code,
      client_id: SLACK_CLIENT_ID,
      client_secret: SLACK_CLIENT_SECRET,
      redirect_uri: redirectUri
    });
    return response;
  }
};