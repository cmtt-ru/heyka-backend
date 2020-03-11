'use strict';

const Schmervice = require('schmervice');
const uuid4 = require('uuid/v4');
const rp = require('request-promise');
const helpers = require('./helpers');
const DEFAULT_JANUS_URL = process.env.DEFAULT_JANUS_URL || 'http://172.17.0.4';

/**
 * Creates session with Janus instance
 * @param {string} url Janus server URL
 * @param {string} serverAuthToken User-related auth token for server
 */
const createSession = async (url, serverAuthToken) => {
  const transaction = uuid4();
  const response = await rp({
    method: 'POST',
    url,
    json: true,
    body: {
      transaction,
      janus: 'create',
      token: serverAuthToken
    }
  });
  return response;
};

/**
 * Creates room in audiobridge plugin
 * @param {object} config Create room config
 */
const createAudioBridgeRoom = async ({
  sessionId,
  channelId,
  url,
  permanent,
  pluginHandle,
  serverAuthToken,
  channelSecret,
  pluginSecret
}) => {
  const transaction = uuid4();
  const response = await rp({
    method: 'POST',
    url: `${url}/${sessionId}/${pluginHandle}`,
    json: true,
    body: {
      janus: 'message',
      transaction,
      token: serverAuthToken,
      body: {
        request: 'create',
        admin_key: pluginSecret,
        description: channelId,
        permanent,
        secret: channelSecret,
        is_private: false,
        sampling_rate: 32000,
        allowed: []
      }
    }
  });
  if (response.janus !== 'success') {
    throw new Error(
      `Error at create audiobridge room (${response.error.code}): `
      + response.error.reason
    );
  }
  return response.plugindata.data;
};

/**
 * Creates room in videoroom plugin
 * @param {object} config Create room config
 */
const createVideoRoom = async ({
  sessionId,
  channelId,
  url,
  permanent,
  pluginHandle,
  serverAuthToken,
  channelSecret,
  pluginSecret
}) => {
  const transaction = uuid4();
  const response = await rp({
    method: 'POST',
    url: `${url}/${sessionId}/${pluginHandle}`,
    json: true,
    body: {
      janus: 'message',
      transaction,
      token: serverAuthToken,
      body: {
        request: 'create',
        admin_key: pluginSecret,
        permanent,
        description: channelId,
        is_private: false,
        secret: channelSecret,
        allowed: []
      }
    }
  });
  if (response.janus !== 'success') {
    throw new Error(
      `Error at create videoroom room (${response.error.code}): `
      + response.error.reason
    );
  }
  return response.plugindata.data;
};

/**
 * Deletes room in audiobridge plugin
 * @param {object} param0 Delete room config
 */
const deleteAudioBridgeRoom = async ({
  sessionId,
  channelId,
  url,
  permanent,
  pluginHandle,
  serverAuthToken,
  channelSecret
}) => {
  const transaction = uuid4();
  const response = await rp({
    method: 'POST',
    url: `${url}/${sessionId}/${pluginHandle}`,
    json: true,
    body: {
      janus: 'message',
      transaction,
      token: serverAuthToken,
      body: {
        request: 'destroy',
        room: channelId,
        permanent,
        secret: channelSecret
      }
    }
  });
  if (response.janus !== 'success') {
    throw new Error(
      `Error at destroy audiobridge room (${response.error.code}): `
      + response.error.reason
    );
  }
  return response.plugindata.data;
};

/**
 * Deletes room in video room plugin
 * @param {object} param0 Delete room config
 */
const deleteVideoRoom = async ({
  sessionId,
  channelId,
  url,
  permanent,
  pluginHandle,
  serverAuthToken,
  channelSecret
}) => {
  const transaction = uuid4();
  const response = await rp({
    method: 'POST',
    url: `${url}/${sessionId}/${pluginHandle}`,
    json: true,
    body: {
      janus: 'message',
      transaction,
      token: serverAuthToken,
      body: {
        request: 'destroy',
        room: channelId,
        permanent,
        secret: channelSecret
      }
    }
  });
  if (response.janus !== 'success') {
    throw new Error(
      `Error at destroy audiobridge room (${response.error.code}): `
      + response.error.reason
    );
  }
  return response.plugindata.data;
};

/**
 * Creates plugin handle
 * @param {object} config Create handle config
 */
const attachToPlugin = ({ plugin, sessionId, url, serverAuthToken }) => {
  const transaction = uuid4();
  return rp({
    method: 'POST',
    url: `${url}/${sessionId}`,
    json: true,
    body: {
      janus: 'attach',
      plugin,
      transaction,
      token: serverAuthToken
    }
  });
};

module.exports = class JanusWorkspaceService extends Schmervice.Service {

  constructor (...args) {
    super(...args);
  }

  /**
   * Send request for creating janus server and returns id and url of it
   * @returns {object} Object with an external id and url of the created Janus server
   */
  async createServer () {
    // TODO: Make request to the external API and create server
    const janusInfo = {
      id: uuid4(),
      url: DEFAULT_JANUS_URL,
      api_port: 8088,
      api_path: 'janus',
      admin_path: 'admin',
      admin_port: 7088,
      admin_secret: 'wowwhattheheck',
      plugin_secrets: {
        audiobridge: 'superse2cret',
        videoroom: 'supersecret'
      }
    };

    // Make request and add auth token for server for creating sessions
    const serverAuthToken = await helpers.getRandomCode(50);
    await this.addAuthTokenForWorkspace(serverAuthToken, janusInfo);

    janusInfo.server_auth_token = serverAuthToken;
    console.log('janus info here: ', janusInfo);
    return janusInfo;
  }

  /**
   * Creates rooms in janus.plugin.audiobridge and janus.plugin.videoroom
   * @param {uuid} id Backend channel id
   * @param {object} janusServerInfo Janus server info (url, admin secrets etc.)
   * @param {string} channelSecret Janus channel secrets
   * @returns {object} { audioRoomId, videoRoomId } - generated by Janus ids
   */
  async createAudioVideoRooms (id, janusServerInfo, channelSecret) {
    const url = janusServerInfo.url
      + `:${janusServerInfo.api_port}`
      + `/${janusServerInfo.api_path}`;

    // create Janus session
    const session = await createSession(url, janusServerInfo.server_auth_token);

    // create plugin handles for AudioBridge & VideoRoom
    const audioBridgePluginHandle = await attachToPlugin({
      plugin: 'janus.plugin.audiobridge',
      url,
      sessionId: session.data.id,
      serverAuthToken: janusServerInfo.server_auth_token
    });
    const videoRoomPluginHandle = await attachToPlugin({
      plugin: 'janus.plugin.videoroom',
      url,
      sessionId: session.data.id,
      serverAuthToken: janusServerInfo.server_auth_token
    });

    // Create rooms in the both plugins
    const result_ab = await createAudioBridgeRoom({
      sessionId: session.data.id,
      pluginHandle: audioBridgePluginHandle.data.id,
      channelId: id,
      url,
      permanent: false,
      serverAuthToken: janusServerInfo.server_auth_token,
      channelSecret,
      pluginSecret: janusServerInfo.plugin_secrets.audiobridge
    });
    const result_vr = await createVideoRoom({
      sessionId: session.data.id,
      pluginHandle: videoRoomPluginHandle.data.id,
      channelId: id,
      url,
      permanent: false,
      serverAuthToken: janusServerInfo.server_auth_token,
      channelSecret,
      pluginSecret: janusServerInfo.plugin_secrets.videoroom
    });

    // Check either are these requests succeed
    if (result_ab.audiobridge !== 'created') {
      throw new Error(
        `Creating AudioBridge room error (${result_ab.error_code}): `
        + result_ab.error
        + JSON.stringify(result_ab)
      );
    } 
    if (result_vr.videoroom !== 'created') {
      throw new Error(
        `Creating VideoRoom room error (${result_vr.error_code}): `
        + result_vr.error
        + JSON.stringify(result_vr)
      );
    }

    // Return generated by Janus id for AudioBridge and VideoRoom
    return {
      audioRoomId: result_ab.room,
      videoRoomId: result_vr.room
    };
  }

  /**
   * Deletes audio and video room from the janus server
   * @param {number} audioRoomId Janus audio room id
   * @param {number} videoRoomId Janus video room id
   * @param {string} secret String 
   * @param {object} janusServerInfo Janus server info 
   */
  async deleteAudioVideoRooms (audioRoomId, videoRoomId, secret, janusServerInfo) {
    const url = janusServerInfo.url
      + `:${janusServerInfo.api_port}`
      + `/${janusServerInfo.api_path}`;

    // create Janus session
    const session = await createSession(url, janusServerInfo.server_auth_token);

    // create plugin handles for AudioBridge & VideoRoom
    const audioBridgePluginHandle = await attachToPlugin({
      plugin: 'janus.plugin.audiobridge',
      url,
      sessionId: session.data.id,
      serverAuthToken: janusServerInfo.server_auth_token
    });
    const videoRoomPluginHandle = await attachToPlugin({
      plugin: 'janus.plugin.videoroom',
      url,
      sessionId: session.data.id,
      serverAuthToken: janusServerInfo.server_auth_token
    });

    // Create rooms in the both plugins
    const result_ab = await deleteAudioBridgeRoom({
      sessionId: session.data.id,
      pluginHandle: audioBridgePluginHandle.data.id,
      channelId: audioRoomId,
      url,
      permanent: false,
      serverAuthToken: janusServerInfo.server_auth_token,
      secret
    });
    const result_vr = await deleteVideoRoom({
      sessionId: session.data.id,
      pluginHandle: videoRoomPluginHandle.data.id,
      channelId: videoRoomId,
      url,
      permanent: false,
      serverAuthToken: janusServerInfo.server_auth_token,
      secret
    });

    // Check either are these requests succeed
    if (result_ab.audiobridge !== 'destroyed') {
      throw new Error(
        `Destroying AudioBridge room error (${result_ab.error_code}): `
        + result_ab.error
        + JSON.stringify(result_ab)
      );
    } 
    if (result_vr.videoroom !== 'destroyed') {
      throw new Error(
        `Destroying VideoRoom room error (${result_vr.error_code}): `
        + result_vr.error
        + JSON.stringify(result_vr)
      );
    }

    // Return generated by Janus id for AudioBridge and VideoRoom
    return {
      audioRoomId: result_ab.room,
      videoRoomId: result_vr.room
    };
  }

  /**
   * Adds auth token to the janus workspace
   * @param {string} token Auth token
   * @param {object} janusServerInfo Object with janus server connection
   */
  async addAuthTokenForWorkspace(token, janusServerInfo) {
    const url = janusServerInfo.url
      + `:${janusServerInfo.admin_port}`
      + `/${janusServerInfo.admin_path}`;

    await rp({
      url,
      method: 'POST',
      body: {
        janus: 'add_token',
        token,
        admin_secret: janusServerInfo.admin_secret,
        transaction: uuid4()
      },
      json: true
    });
  }

  /**
   * Deletes auth token for the workspace from janus server
   * @param {string} token token
   * @param {object} janusServerInfo Janus server info
   */
  async deleteAuthTokenForWorkspace(token, janusServerInfo) {
    const url = janusServerInfo
      + `:${janusServerInfo.admin_port}`
      + `/${janusServerInfo.admin_path}`;

    await rp({
      url,
      method: 'POST',
      body: {
        janus: 'remove_token',
        token,
        admin_secret: janusServerInfo.admin_secret,
        transaction: uuid4()
      },
      json: true
    });
  }

  /**
   * Connects to the Janus server and add/remove tokens to 
   * audio and video room
   * @param {string} action "add" or "remove"
   * @param {number} audioRoomId Janus audio room id
   * @param {number} videoRoomId Janus video room id
   * @param {string} token token string
   * @param {object} janusServerInfo Janus connection info
   * @param {string} channelSecret Channel secret code (for configuring channel)
   */
  async manageAuthTokensForChannel(
    action,
    audioRoomId,
    videoRoomId,
    tokens,
    janusServerInfo,
    channelSecret
  ) {
    // validate action
    if (action !== 'add' && action !== 'remove') {
      throw new Error('Action must be one of ["add", "remove"]');
    }

    const url = janusServerInfo.url
      + `:${janusServerInfo.api_port}`
      + `/${janusServerInfo.api_path}`;

    // create Janus session
    const session = await createSession(url, janusServerInfo.server_auth_token);

    // create plugin handles for AudioBridge & VideoRoom
    const audioBridgePluginHandle = await attachToPlugin({
      plugin: 'janus.plugin.audiobridge',
      url,
      sessionId: session.data.id,
      serverAuthToken: janusServerInfo.server_auth_token
    });
    const videoRoomPluginHandle = await attachToPlugin({
      plugin: 'janus.plugin.videoroom',
      url,
      sessionId: session.data.id,
      serverAuthToken: janusServerInfo.server_auth_token
    });

    const manage_ab = manageTokensForPlugin(action, tokens, {
      sessionId: session.data.id,
      roomId: audioRoomId,
      url,
      pluginHandle: audioBridgePluginHandle.data.id,
      serverAuthToken: janusServerInfo.server_auth_token,
      channelSecret
    });
    
    const manage_vr = manageTokensForPlugin(action, tokens, {
      sessionId: session.data.id,
      roomId: videoRoomId,
      url,
      pluginHandle: videoRoomPluginHandle.data.id,
      serverAuthToken: janusServerInfo.server_auth_token,
      channelSecret
    });

    const results = await Promise.all([manage_ab, manage_vr]);

    // Check either are these requests succeed
    if (results[0].audiobridge !== 'success') {
      throw new Error(
        `Manage tokens in audiobridge error (${results[0].error_code}): `
        + results[0].error
        + JSON.stringify(results[0])
      );
    } 
    if (results[1].videoroom !== 'success') {
      throw new Error(
        `Manage tokens in videoroom error (${results[1].error_code}): `
        + results[1].error
        + JSON.stringify(results[1])
      );
    }
  }
};

/**
 * Adds/remove provided tokens in the list of allowed tokens
 * for the channel in a plugin
 * @param {string} action add | remove
 * @param {string} token auth token
 * @param {object} config Allow plugin config  
 */
async function manageTokensForPlugin(action, tokens, {
  sessionId,
  roomId,
  url,
  pluginHandle,
  channelSecret,
  serverAuthToken
}) {
  // validate action
  if (action !== 'add' && action !== 'remove') {
    throw new Error('Action should be one of ["add", "remove"]');
  }

  // make request
  const transaction = uuid4();
  const response = await rp({
    method: 'POST',
    url: `${url}/${sessionId}/${pluginHandle}`,
    json: true,
    body: {
      janus: 'message',
      transaction,
      token: serverAuthToken,
      body: {
        request: 'allowed',
        secret: channelSecret,
        room: roomId,
        action,
        allowed: tokens
      }
    }
  });
  if (response.janus !== 'success') {
    throw new Error(
      `Error at manage tokens in plugin (${response.error.code}): `
      + response.error.reason
    );
  }
  return response.plugindata.data;
}
