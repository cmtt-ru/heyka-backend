import store from '@/store';
import eventNames from './eventNames';
import { client, connect } from './client';
import { getAccessToken } from '../tokens';
import { handleError } from '@api/errors';
import Logger from '@classes/logger';

const cnsl = new Logger('SOCKETS', '#d67a24');

const DISCONNECT_TIMEOUT = 2000;

/**
 * Connect to socket, authorize and bind events
 *
 * @returns {Promise<void>}
 */
export async function init() {
  /** Trying to connect */
  try {
    await connect();
  } catch (e) {
    handleError(e);
  }

  /** Bind error events */
  bindErrorEvents();

  /** Channel select/unselect  */
  bindChannelEvents();

  /** User events */
  bindUserEvents();

  /** Trying to authorize */
  try {
    await authorize();
  } catch (e) {
    handleError(e);
  }
}

/**
 * Save current socket id and time
 *
 * @return {void}
 */
export async function saveSocketParams() {
  store.commit('app/SET_SOCKET_ID', {
    id: client.lastSocketId,
    connectedAt: Date.now(),
  });
}

/**
 * Socket connected status
 *
 * @return {boolean}
 */
export function connected() {
  return client.connected;
}

/**
 * Destroy & connect to sockets
 *
 * @returns {void}
 */
export async function reconnect() {
  await destroy();
  await init();
}

/**
 * Destroy socket connection and unbind events
 *
 * @returns {Promise<void>}
 */
export async function destroy() {
  client.disconnect();

  Object.values(eventNames).forEach(eventName => {
    client.removeAllListeners(eventName);
  });
}

/**
 * Authorize in socket
 *
 * @param {string?} prevSocketId Previous socket id
 * @returns {promise}
 */
async function authorize(prevSocketId) {
  const accessToken = await getAccessToken();
  const onlineStatus = 'online';

  return new Promise((resolve, reject) => {
    client.once(eventNames.authSuccess, data => {
      cnsl.log('socket auth success:', data);
      store.dispatch('setSocketConnected', {
        connected: true,
        ...data,
      });
      resolve(data);
    });

    client.once(eventNames.authSuccessError, data => {
      console.error('socket auth error', data);
      reject(data);
    });

    const authData = {
      transaction: 'auth',
      workspaceId: store.getters['me/getSelectedWorkspaceId'],
      token: accessToken,
      onlineStatus: onlineStatus,
      ...(prevSocketId ? { prevSocketId } : prevSocketId),
    };

    client.emit(eventNames.auth, authData);
  });
}

/**
 * Bind error events
 *
 * @returns {void}
 */
function bindErrorEvents() {
  client.on(eventNames.disconnect, data => {
    cnsl.log('disconnect', data);
    store.dispatch('setSocketConnected', false);

    // remember latest socket id
    saveSocketParams();
  });

  client.on(eventNames.reconnect, data => {
    // rewrite last socket id
    client.lastSocketId = client.id;

    cnsl.info('reconnected:', data);

    // try to authorize new connection as the old connection
    const prevSocketParams = store.state.app.socket;

    const timeFromLastSocketConnected = Date.now() - parseInt(prevSocketParams.connectedAt);

    if (timeFromLastSocketConnected < DISCONNECT_TIMEOUT) {
      authorize(prevSocketParams.id);
    } else {
      authorize();
    }
  });

  client.on(eventNames.error, data => {
    console.error('error', data);
  });

  client.on(eventNames.socketApiError, error => {
    console.error('socket-api-error', error.event, error.message);
  });
}

/**
 * Bind channel events
 *
 * @returns {void}
 */
function bindChannelEvents() {
  /** Unselect channel */
  client.on(eventNames.userUnselectedChannel, data => {
    if (data.socketId === client.id) {
      return;
    }

    store.commit('channels/REMOVE_USER', data);
  });

  /** Select channel */
  client.on(eventNames.userSelectedChannel, data => {
    if (data.socketId === client.id) {
      return;
    }

    store.commit('channels/ADD_USER', data);
  });
}

/**
 * Bind user events
 *
 * @returns {void}
 */
function bindUserEvents() {
  /** User media status changed */
  client.on(eventNames.mediaStateUpdated, data => {
    store.commit('channels/SET_USER_MEDIA_STATE', data);
  });

  /** User info changed */
  client.on(eventNames.userUpdated, data => {
    store.commit('users/UPDATE_USER', data.user);
  });

  /** User joined workspace */
  client.on(eventNames.userJoined, async data => {
    store.dispatch('updateCurrentWorkspaceState');
  });

  /** User leaved workspace */
  client.on(eventNames.userLeavedWorkspace, async data => {
    store.dispatch('updateCurrentWorkspaceState');
  });

  /** Muted for all */
  client.on(eventNames.mutedForAll, async data => {
    if (data.socketId === client.id) {
      store.dispatch('me/mutedByUser', data.fromUserId);
    }
  });

  /** Me kicked from workspace */
  client.on(eventNames.kickedFromWorkspace, async data => {
    cnsl.log('kickedFromWorkspace');
  });
}
