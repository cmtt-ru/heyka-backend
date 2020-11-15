'use strict';

const Schmervice = require('schmervice');
const uuid4 = require('uuid/v4');
const rp = require('request-promise');
const helpers = require('./helpers');
const config = require('../../config');
const { Client, KubeConfig, Client1_13 } = require('kubernetes-client');
const Request = require('kubernetes-client/backends/request');
const { format: formatUrl } = require('url');
const {
  uniqueNamesGenerator,
  adjectives,
  colors,
  animals,
} = require('unique-names-generator');

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
  room,
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
        room,
        request: 'create',
        admin_key: pluginSecret,
        description: channelId,
        permanent,
        secret: channelSecret,
        is_private: true,
        sampling_rate: 48000,
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
  room,
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
        room,
        request: 'create',
        admin_key: pluginSecret,
        permanent,
        description: channelId,
        is_private: true,
        secret: channelSecret,
        publishers: 32,
        allowed: [],
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
 * Creates room in textroom plugin
 * @param {object} config Create room config
 */
const createTextRoom = async ({
  room,
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
        room,
        request: 'create',
        admin_key: pluginSecret,
        permanent,
        description: channelId,
        is_private: true,
        secret: channelSecret,
        allowed: [],
      }
    }
  });
  if (response.janus !== 'success') {
    throw new Error(
      `Error at create textroom room (${response.error.code}): `
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
      `Error at destroy videroom room (${response.error.code}): `
      + response.error.reason
    );
  }
  return response.plugindata.data;
};

/**
 * Deletes room in text room plugin
 * @param {object} param0 Delete room config
 */
const deleteTextRoom = async ({
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
      `Error at destroy textroom room (${response.error.code}): `
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
  
    if (config.janus.k8sClusterHost) {
      const kubeconfig = new KubeConfig({
        url: config.janus.k8sClusterHost
      });
      kubeconfig.loadFromDefault();
      this.k8sClient = new Client({
        backend: new Request({ kubeconfig }),
        version: '1.13'
      });
    }

    this.janusNodes = [];
  }

  /**
   * Generate janus channel object
   * with audio room id, video room id, secret
   * and workspace server information
   * @returns {object} Janus channel info
   */
  async getJanus() {
    // choose Janus Node with minimal registered channels
    let minimalChannelsNode = this.janusNodes[0];
    for (let i in this.janusNodes) {
      if (this.janusNodes[i].channels < minimalChannelsNode.channels) {
        minimalChannelsNode = this.janusNodes[i];
      }
    }

    minimalChannelsNode.channels +=1 ;

    return {
      ...minimalChannelsNode
    };
  }

  /**
   * Generate Janus domain name by IP address
   * @param {string} ip External IP address
   * @returns {string} domain name
   */
  getJanusDomainName(ip) {
    const uniqueName = uniqueNamesGenerator({
      length: 3,
      dictionaries: [adjectives, colors, animals],
      separator: '-',
      seed: parseInt(ip.replace(/\./g, ''), 10),
    });
    return `hey-node-${uniqueName}-${ip.replace(/\./g, '-')}.infr.heyka.io`;
  }

  /**
   * Fetch list of janus nodes from k8s
   */
  async fetchJanusNodes() {
    if (!config.janus.k8sClusterHost) {
      return [];
    }

    // k8s cluster is used
    const k8sResult = await this.k8sClient.api.v1.nodes.get({
      qs: {
        labelSelector: config.janus.k8sJanusLabelSelector
      }
    });
    return k8sResult.body.items;
  }

  /**
   * Get stream of any node updates in kubernetes
   */
  async getNodeUpdatesStream() {
    if (!config.janus.k8sClusterHost) {
      return null;
    }
    
    return await this.k8sClient.api.v1.watch.nodes.get({
      qs: {
        labelSelector: config.janus.k8sJanusLabelSelector,
        watch: true,
      },
    });
  }

  /**
   * Decrement channels count for specific janus server
   * @param {string} janusName Janus server name
   * @returns {void}
   */
  decrementJanusChannelsFor(janusName) {
    for (let i in this.janusNodes) {
      if (this.janusNodes[i].name === janusName) {
        this.janusNodes[i].channels -= 1;
        break;
      }
    }
  }

  /**
   * Make request to k8s and fill janus node array
   */
  async initJanusNodes() {
    this.janusNodes = [];

    const defaultOpts = {
      apiPath: 'janus',
      apiPort: 8088,
      publicHttpsPort: 8089,
      publicWssPort: 8989,
      adminPath: 'admin',
      adminPort: 7088,
      adminSecret: 'wowwhattheheck',
      pluginSecrets: {
        audiobridge: 'superse2cret',
        videoroom: 'supersecret',
        textroom: 'ssupersecret'
      },
      channels: 0
    };

    // k8s cluster is not used
    if (!config.janus.k8sClusterHost) {
      this.janusNodes.push({
        url: config.janus.defaultJanusUrl,
        publicUrl: config.janus.defaultPublicJanusUrl,
        publicHttpsUrl: `${config.janus.defaultPublicJanusUrl}:8088/janus`,
        publicWssUrl: `${config.janus.defaultPublicJanusUrl}:8089`,
        name: 'default',
        ...defaultOpts
      });
    } else {

      // k8s cluster is used
      const k8sResult = await this.k8sClient.api.v1.nodes.get({
        qs: {
          labelSelector: config.janus.k8sJanusLabelSelector
        }
      });

      if (k8sResult.statusCode !== 200) {
        throw new Error(`Not successful response from k8s, statusCode ${k8sResult.statusCode}`);
      }

      if (k8sResult.body.items.length === 0) {
        throw new Error('No janus nodes were found');
      }

      for (let i in k8sResult.body.items) {
        const janusNode = {
          ...defaultOpts
        };
        const addresses = k8sResult.body.items[i].status.addresses;
        for (let j in addresses) {
          switch (addresses[j].type) {
          case 'ExternalIP':
            janusNode.publicHttpsUrl = formatUrl({
              hostname: this.getJanusDomainName(addresses[j].address),
              protocol: 'https',
              port: defaultOpts.publicHttpsPort,
              pathname: defaultOpts.apiPath,
            });
            janusNode.publicWssUrl = formatUrl({
              hostname: this.getJanusDomainName(addresses[j].address),
              protocol: 'wss',
              port: defaultOpts.publicWssPort,
            });
            break;
          case 'InternalIP':
            janusNode.url = formatUrl({
              hostname: addresses[j].address,
              protocol: 'http'
            });
            break;
          case 'Hostname': janusNode.name = addresses[j].address; break;
          }
        }
        this.janusNodes.push(janusNode);
      }
    }

    // add auth tokens for backend requests
    for (let i in this.janusNodes) {
      const token = await helpers.getRandomCode(50);
      this.janusNodes[i].authToken = token;
      await this.addAuthTokenForWorkspace(token, this.janusNodes[i]);
    }

    this.server.log(['debug'], 'Initialized janus nodes with items:\n ' + JSON.stringify(this.janusNodes, null, 2));
  }

  /**
   * Creates rooms in janus.plugin.audiobridge and janus.plugin.videoroom
   * @param {object} janusChannelInfo Janus channel info (room, secret)
   * @param {uuid} id Backend channel id
   * @param {object} janusServerInfo Janus server info (url, admin secrets etc.)
   * @returns {object} { audioRoomId, videoRoomId } - generated by Janus ids
   */
  async createAudioVideoRooms (janusChannelInfo, id, janusServerInfo) {
    const url = janusServerInfo.url
      + `:${janusServerInfo.apiPort}`
      + `/${janusServerInfo.apiPath}`;

    // create Janus session
    const session = await createSession(url, janusServerInfo.authToken);

    // create plugin handles for AudioBridge & VideoRoom
    const audioBridgePluginHandle = await attachToPlugin({
      plugin: 'janus.plugin.audiobridge',
      url,
      sessionId: session.data.id,
      serverAuthToken: janusServerInfo.authToken
    });
    const videoRoomPluginHandle = await attachToPlugin({
      plugin: 'janus.plugin.videoroom',
      url,
      sessionId: session.data.id,
      serverAuthToken: janusServerInfo.authToken
    });
    const textRoomPluginHundle = await attachToPlugin({
      plugin: 'janus.plugin.textroom',
      url,
      sessionId: session.data.id,
      serverAuthToken: janusServerInfo.authToken
    });

    // Create rooms in the both plugins
    const result_ab = await createAudioBridgeRoom({
      room: janusChannelInfo.room,
      sessionId: session.data.id,
      pluginHandle: audioBridgePluginHandle.data.id,
      channelId: id,
      url,
      permanent: false,
      serverAuthToken: janusServerInfo.authToken,
      channelSecret: janusChannelInfo.secret,
      pluginSecret: janusServerInfo.pluginSecrets.audiobridge
    });
    const result_vr = await createVideoRoom({
      room: janusChannelInfo.room,
      sessionId: session.data.id,
      pluginHandle: videoRoomPluginHandle.data.id,
      channelId: id,
      url,
      permanent: false,
      serverAuthToken: janusServerInfo.authToken,
      channelSecret: janusChannelInfo.secret,
      pluginSecret: janusServerInfo.pluginSecrets.videoroom
    });
    const result_tr = await createTextRoom({
      room: janusChannelInfo.room,
      sessionId: session.data.id,
      pluginHandle: textRoomPluginHundle.data.id,
      channelId: id,
      url,
      permanent: false,
      serverAuthToken: janusServerInfo.authToken,
      channelSecret: janusChannelInfo.secret,
      pluginSecret: janusServerInfo.pluginSecrets.textroom
    });

    // Check either are these requests succeed
    if (result_ab.audiobridge !== 'created') {
      if (result_ab.error.includes('already exists')) {
        throw new Error('AlreadyExists');
      }
      throw new Error(
        `Creating AudioBridge room error (${result_ab.error_code}): `
        + result_ab.error
        + JSON.stringify(result_ab)
      );
    } 
    if (result_vr.videoroom !== 'created') {
      if (result_vr.error.includes('already exists')) {
        throw new Error('AlreadyExists');
      }
      throw new Error(
        `Creating VideoRoom room error (${result_vr.error_code}): `
        + result_vr.error
        + JSON.stringify(result_vr)
      );
    }
    if (result_tr.textroom !== 'created') {
      if (result_tr.error.includes('already exists')) {
        throw new Error('AlreadyExists');
      }
      throw new Error(
        `Creating TextRoom room error (${result_tr.error_code}): `
        + result_tr.error
        + JSON.stringify(result_tr)
      );
    }

    // Return generated by Janus id for AudioBridge and VideoRoom
    return {
      audioRoomId: result_ab.room,
      videoRoomId: result_vr.room,
      textRoomId: result_tr.room
    };
  }

  /**
   * Deletes audio and video room from the janus server
   * @param {object} janusServerInfo Janus server info
   * @param {object} janusChannelInfo Janus channel info (room, secret)
   */
  async deleteAudioVideoRooms (janusServerInfo, janusChannelInfo) {
    const url = janusServerInfo.url
      + `:${janusServerInfo.apiPort}`
      + `/${janusServerInfo.apiPath}`;

    // create Janus session
    const session = await createSession(url, janusServerInfo.authToken);

    // create plugin handles for AudioBridge & VideoRoom
    const audioBridgePluginHandle = await attachToPlugin({
      plugin: 'janus.plugin.audiobridge',
      url,
      sessionId: session.data.id,
      serverAuthToken: janusServerInfo.authToken
    });
    const videoRoomPluginHandle = await attachToPlugin({
      plugin: 'janus.plugin.videoroom',
      url,
      sessionId: session.data.id,
      serverAuthToken: janusServerInfo.authToken
    });
    const textRoomPluginHandle = await attachToPlugin({
      plugin: 'janus.plugin.textroom',
      url,
      sessionId: session.data.id,
      serverAuthToken: janusServerInfo.authToken
    });

    // Create rooms in the both plugins
    const result_ab = await deleteAudioBridgeRoom({
      sessionId: session.data.id,
      pluginHandle: audioBridgePluginHandle.data.id,
      channelId: janusChannelInfo.room,
      url,
      permanent: false,
      serverAuthToken: janusServerInfo.authToken,
      channelSecret: janusChannelInfo.secret
    });
    const result_vr = await deleteVideoRoom({
      sessionId: session.data.id,
      pluginHandle: videoRoomPluginHandle.data.id,
      channelId: janusChannelInfo.room,
      url,
      permanent: false,
      serverAuthToken: janusServerInfo.authToken,
      channelSecret: janusChannelInfo.secret
    });
    const result_tr = await deleteTextRoom({
      sessionId: session.data.id,
      pluginHandle: textRoomPluginHandle.data.id,
      channelId: janusChannelInfo.room,
      url,
      permanent: false,
      serverAuthToken: janusServerInfo.authToken,
      channelSecret: janusChannelInfo.secret
    });

    // Check either are these requests succeed
    if (result_ab.audiobridge !== 'destroyed') {
      if (result_ab.error.includes('No such room')) {
        throw new Error('RoomAlreadyDeleted');
      }
      throw new Error(
        `Destroying AudioBridge room error (${result_ab.error_code}): `
        + result_ab.error
        + JSON.stringify(result_ab)
      );
    } 
    if (result_vr.videoroom !== 'destroyed') {
      if (result_vr.error.includes('No such room')) {
        throw new Error('RoomAlreadyDeleted');
      }
      throw new Error(
        `Destroying VideoRoom room error (${result_vr.error_code}): `
        + result_vr.error
        + JSON.stringify(result_vr)
      );
    }
    if (result_tr.textroom !== 'destroyed') {
      if (result_tr.error.includes('No such room')) {
        throw new Error('RoomAlreadyDeleted');
      }
      throw new Error(
        `Destroying VideoRoom room error (${result_tr.error_code}): `
        + result_tr.error
        + JSON.stringify(result_tr)
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
      + `:${janusServerInfo.adminPort}`
      + `/${janusServerInfo.adminPath}`;

    await rp({
      url,
      method: 'POST',
      body: {
        janus: 'add_token',
        token,
        admin_secret: janusServerInfo.adminSecret,
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
    const url = janusServerInfo.url
      + `:${janusServerInfo.adminPort}`
      + `/${janusServerInfo.adminPath}`;

    await rp({
      url,
      method: 'POST',
      body: {
        janus: 'remove_token',
        token,
        admin_secret: janusServerInfo.adminSecret,
        transaction: uuid4()
      },
      json: true
    });
  }

  /**
   * Connects to the Janus server and add/remove tokens to 
   * audio and video room
   * @param {string} action "add" or "remove"
   * @param {string} token token string
   * @param {object} janusServerInfo Janus connection info
   * @param {object} janusChannelInfo Janus channel info (secret, room)
   */
  async manageAuthTokensForChannel(
    action,
    tokens,
    janusServerInfo,
    janusChannelInfo
  ) {
    // validate action
    if (action !== 'add' && action !== 'remove') {
      throw new Error('Action must be one of ["add", "remove"]');
    }

    const url = janusServerInfo.url
      + `:${janusServerInfo.apiPort}`
      + `/${janusServerInfo.apiPath}`;

    // create Janus session
    const session = await createSession(url, janusServerInfo.authToken);

    // create plugin handles for AudioBridge & VideoRoom
    const audioBridgePluginHandle = await attachToPlugin({
      plugin: 'janus.plugin.audiobridge',
      url,
      sessionId: session.data.id,
      serverAuthToken: janusServerInfo.authToken
    });
    const videoRoomPluginHandle = await attachToPlugin({
      plugin: 'janus.plugin.videoroom',
      url,
      sessionId: session.data.id,
      serverAuthToken: janusServerInfo.authToken
    });

    const manage_ab = manageTokensForPlugin(action, tokens, {
      sessionId: session.data.id,
      roomId: janusChannelInfo.room,
      url,
      pluginHandle: audioBridgePluginHandle.data.id,
      serverAuthToken: janusServerInfo.authToken,
      channelSecret: janusChannelInfo.secret
    });
    
    const manage_vr = manageTokensForPlugin(action, tokens, {
      sessionId: session.data.id,
      roomId: janusChannelInfo.room,
      url,
      pluginHandle: videoRoomPluginHandle.data.id,
      serverAuthToken: janusServerInfo.authToken,
      channelSecret: janusChannelInfo.secret
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
  
  /**
   * Get admin janus stats for all janus servers
   */
  async getJanusStatsForAllServers() {
    const allStats = await Promise.all(this.janusNodes.map(janusNode => this.getJanuStatsForServer(janusNode)));
    return allStats.reduce((result, statForServer, index) => ({
      ...result,
      [this.janusNodes[index].publicHttpsUrl]: statForServer
    }), {});
  }
  
  /**
   * Get janus stats for specific server
  */
  async getJanuStatsForServer(janusServerInfo) {
    const result = {};
    const apiRequestUrl = `${janusServerInfo.url}:${janusServerInfo.adminPort}/${janusServerInfo.adminPath}`;

    const sessionsResponse = await rp.post(apiRequestUrl, {
      json: true,
      body: {
        janus: 'list_sessions',
        transaction: uuid4(),
        admin_secret: janusServerInfo.adminSecret,
      }
    });

    await Promise.all(sessionsResponse.sessions.map(async session => {
      result[session] = {};

      const { handles } = await rp.post(apiRequestUrl + '/' + session, {
        json: true,
        body: {
          janus: 'list_handles',
          transaction: uuid4(),
          admin_secret: janusServerInfo.adminSecret,
        }
      });
      
      await Promise.all(handles.map(async handle => {
        const { info } = await rp.post(`${apiRequestUrl}/${session}/${handle}`, {
          json: true,
          body: {
            janus: 'handle_info',
            transaction: uuid4(),
            admin_secret: janusServerInfo.adminSecret,
          }
        });

        result[session][handle] = info;
      }));
      return {};
    }));

    return result;
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
