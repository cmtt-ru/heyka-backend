'use strict';

const Schmervice = require('schmervice');
const eventNames = require('../socket/event_names');

module.exports = class ApiEventService extends Schmervice.Service {
  constructor (...args) {
    super(...args);
  }

  /**
   * Generates api-event about channel created
   * @param {string} workspaceId Workspace id
   * @param {string} channelId Channel id
  */
  channelCreated(workspaceId, channelId) {
    this.server.apiEvents.emit('api-event', {
      data: {
        channelId
      },
      name: eventNames.socket.channelCreated,
      room: eventNames.rooms.workspaceRoom(workspaceId)
    });
  }

  /**
   * Generated api-event about channel deleted
   * @param {string} workspaceId Workspace id
   * @param {string} channelId Channel id
   */
  channelDeleted(workspaceId, channelId) {
    this.server.apiEvents.emit('api-event', {
      data: {
        channelId
      },
      name: eventNames.socket.channelDeleted,
      room: eventNames.rooms.workspaceRoom(workspaceId)
    });
  }

  /**
   * Generates api-event about user joined workspace
   * @param {string} workspaceId workspace id
   * @param {string} userInfo user info object
   */
  userJoined(workspaceId, userInfo) {
    const { displayService } = this.server.services();

    this.server.apiEvents.emit('api-event', {
      data: {
        user: displayService.user(userInfo)
      },
      name: eventNames.socket.userJoined,
      room: eventNames.rooms.workspaceRoom(workspaceId)
    });
  }

  /**
   * Generated api-event about user leaved workspace
   * @param {string} workspaceId workspace id
   * @param {string} userId user id
   */
  userLeavedWorkspace(workspaceId, userId) {
    this.server.apiEvents.emit('api-event', {
      data: {
        userId
      },
      name: eventNames.socket.userLeavedWorkspace,
      room: eventNames.rooms.workspaceRoom(workspaceId)
    });
  }

  /**
   * Generates api-event about user updated for all of user workspaces
   * @param {array<object>} workspaces Array of user workspaces
   * @param {object} userInfo User info object
   */
  userUpdated(workspaces, userInfo) {
    const { displayService } = this.server.services();

    this.server.apiEvents.emit('api-event', {
      data: {
        user: displayService.user(userInfo),
      },
      name: eventNames.socket.userUpdated,
      rooms: workspaces.map(w => eventNames.rooms.workspaceRoom(w.id))
    });
  }

  /**
   * Generates api-event about user selected channel
   * @param {string} userId user id
   * @param {string} channelId channel id
   * @param {object} userMediaState user media state schema
   */
  userSelectedChannel(userId, channelId, userMediaState) {
    this.server.apiEvents.emit('api-event', {
      data: {
        userId,
        channelId,
        userMediaState
      },
      name: eventNames.socket.userSelectedChannel,
      room: eventNames.rooms.channelRoom(channelId)
    });
  }

  /**
   * Generates api-event about user unselected channel
   * @param {string} userId User id
   * @param {string} channelId Channel id
   */
  userUnselectedChannel(userId, channelId) {
    this.server.apiEvents.emit('api-event', {
      data: {
        userId,
        channelId
      },
      name: eventNames.socket.userUnselectedChannel,
      room: eventNames.rooms.channelRoom(channelId)
    });
  }
  
  /**
   * Generates api-event about user changed device
   * @param {string} userId user id
   */
  userChangedDevice(userId) {
    this.server.apiEvents.emit('api-event', {
      data: null,
      name: eventNames.socket.changedDevice,
      room: eventNames.rooms.userRoom(userId)
    });
  }

  mediaStateUpdated(userId, channelId, userMediaState) {
    this.server.apiEvents.emit('api-event', {
      data: {
        userId,
        userMediaState,
        channelId
      },
      name: eventNames.socket.mediaStateUpdated,
      room: eventNames.rooms.channelRoom(channelId)
    });
  }

  onlineStatusUpdated(userId, workspaceId, onlineStatus) {
    this.server.apiEvents.emit('api-event', {
      data: {
        userId,
        onlineStatus
      },
      name: eventNames.socket.onlineStatusChanged,
      room: eventNames.rooms.workspaceRoom(workspaceId)
    });
  }
};