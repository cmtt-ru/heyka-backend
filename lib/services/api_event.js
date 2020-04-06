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
};
