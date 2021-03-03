'use strict';

const Schmervice = require('schmervice');
const { WebClient } = require('@slack/web-api');
const config = require('../../config');
const SLACK_CLIENT_ID = config.credentials.slack.clientId;
const SLACK_CLIENT_SECRET = config.credentials.slack.clientSecret;
const CONNECTING_REDIRECT_PATH = '/slack-redirect';
const JOIN_BY_INVITE_PATH = '/auth';

module.exports = class SlackService extends Schmervice.Service {

  constructor (...args) {
    super(...args);
    this.slack = new WebClient();
  }

  /**
   * Sends invite code by slack
   * @param {string} fromUserName User sender (heyka)
   * @param {string} token Slack access token
   * @param {string} toId User receiver (Slack id)
   * @param {string} workspaceName Workspace name
   * @param {string} code Invite code
   */
  async sendInviteToWorkspace (fromUserName, token, toId, workspaceName, сode) {
    const joinUrl = 'https://'
    + config.publicHostname
    + JOIN_BY_INVITE_PATH
    + `?invite=${сode}`;

    try {
      let createResponse = await this.slack.conversations.open({
        token,
        users: toId
      });
      const channelId = createResponse.channel.id;
      await this.slack.chat.postMessage({
        token,
        channel: channelId,
        text: `*${fromUserName}* invited you `
        + `to *${workspaceName}* workspace in Heyka`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*${fromUserName}* invited you `
              + `to *${workspaceName}* workspace in Heyka`,
            }
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  emoji: true,
                  text: 'Join'
                },
                style: 'primary',
                url: joinUrl,
              }
            ]
          },
        ],
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
    const redirectUri = 'https://'
      + config.publicHostname
      + CONNECTING_REDIRECT_PATH;

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
   * Returns list of slack workspace users
   * @param {string} id Slack team id
   * @param {string} token Bot access token
   * @returns {array}
   */
  async getSlackWorkspaceUserList(id, token) {
    const response = await this.slack.users.list({
      token: token,
      team_id: id,
    });
    if (!response.ok) {
      throw new Error('Slack response is not OK' + JSON.stringify(response, null, 2));
    }
    return response.members;
  }

  /**
   * Exchanges OAuth slack code to a permanent access token
   * @param {string} code OAuth code that has been returned from Slack
   */
  async gainAccessTokenByOAuthCode(code) {
    const redirectUri = 'https://'
    + config.publicHostname
    + CONNECTING_REDIRECT_PATH;

    const response = await this.slack.oauth.v2.access({
      code,
      client_id: SLACK_CLIENT_ID,
      client_secret: SLACK_CLIENT_SECRET,
      redirect_uri: redirectUri
    });
    return response;
  }
};
