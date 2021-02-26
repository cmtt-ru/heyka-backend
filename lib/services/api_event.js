'use strict';

const Schmervice = require('schmervice');
const eventNames = require('../socket/event_names');

module.exports = class ApiEventService extends Schmervice.Service {
  constructor (...args) {
    super(...args);
  }

  /**
   * Notify all workspace participants about workspace info updated
   * 
   * @param {string} workspaceId Workspace id
   * @param {object} workspace Workspace object
   */
  workspaceUpdated(workspaceId, workspace) {
    const {
      displayService
    } = this.server.services();

    this.server.apiEvents.emit('api-event', {
      data: {
        workspace: displayService.workspace(workspace),
      },
      name: eventNames.socket.workspaceUpdated,
      room: eventNames.rooms.workspaceRoom(workspaceId),
    });
  }

  /**
   * Notify user about new workspace added
   * 
   * @param {string} userId Who should be notified
   * @param {object} workspace Workspace info object
   * @param {object} relation Relation between user and workspace
   */
  workspaceAdded(userId, workspace, relation) {
    const {
      displayService
    } = this.server.services();

    this.server.apiEvents.emit('api-event', {
      data: {
        workspace: displayService.workspaceForUser(workspace, relation),
      },
      name: eventNames.socket.workspaceAdded,
      room: eventNames.rooms.userRoom(userId),
    });
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
   * Generates api-event about channel created for single user
   * @param {string} userId User id
   * @param {string} channelId Channel id
  */
  channelCreatedForUser(userId, channelId) {
    this.server.apiEvents.emit('api-event', {
      data: {
        channelId
      },
      name: eventNames.socket.channelCreated,
      room: eventNames.rooms.userRoom(userId)
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
        workspaceId,
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
   * Generates api-event about my profile updated
   * @param {string} userId
   * @param {object} userInfo User info object
   * @param {string} whatWasUpdated What specifically have been updated
   */
  meUpdated(userId, userInfo, whatWasUpdated = undefined) {
    const { displayService } = this.server.services();
    
    this.server.apiEvents.emit('api-event', {
      data: {
        user: displayService.userWithConfidentialData(userInfo),
        whatWasUpdated,
      },
      name: eventNames.socket.meUpdated,
      room: eventNames.rooms.userRoom(userId)
    });
  }

  /**
   * Generates api-event about my online status updated
   * @param {string} userId
   * @param {object} onlineStatus Online status
   */
  myOnlineStatusUpdated(userId, onlineStatus) {
    this.server.apiEvents.emit('api-event', {
      data: {
        onlineStatus
      },
      name: eventNames.socket.myOnlineStatusUpdated,
      room: eventNames.rooms.userRoom(userId)
    });
  }

  /**
   * Notify user about password changed
   * @param {string} userId User id
   */
  passwordChanged(userId) {
    this.server.apiEvents.emit('api-event', {
      data: null,
      name: eventNames.socket.passwordChanged,
      room: eventNames.rooms.userRoom(userId)
    });
  }

  /**
   * Generates api-event about user selected channel
   * @param {string} userId user id
   * @param {string} channelId channel id
   * @param {object} userMediaState user media state schema
   * @param {string} socketId Socket id from device with selected channel
   */
  userSelectedChannel(userId, channelId, userMediaState, socketId) {
    this.server.apiEvents.emit('api-event', {
      data: {
        userId,
        channelId,
        userMediaState,
        socketId
      },
      name: eventNames.socket.userSelectedChannel,
      room: eventNames.rooms.channelRoom(channelId)
    });
  }

  /**
   * Generates api-event about user unselected channel
   * @param {string} userId User id
   * @param {string} channelId Channel id
   * @param {string} socketId Socket id from device that unselected channel
   */
  userUnselectedChannel(userId, channelId, socketId) {
    this.server.apiEvents.emit('api-event', {
      data: {
        userId,
        channelId,
        socketId
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

  /**
   * Api event about user change media state
   * @param {string} userId Who changes media state
   * @param {string} channelId From which channel 
   * @param {MediaState} userMediaState Media state object 
   */
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

  /**
   * Api event about user changes online status
   * @param {string} userId Who changes online status
   * @param {string} workspaceId From which workspace
   * @param {string} onlineStatus New online status
   */
  onlineStatusUpdated(userId, workspaceId, onlineStatus) {
    this.server.apiEvents.emit('api-event', {
      data: {
        userId,
        onlineStatus: onlineStatus || 'offline',
      },
      name: eventNames.socket.onlineStatusChanged,
      room: eventNames.rooms.workspaceRoom(workspaceId)
    });
  }

  /**
   * Send api event about invite in the channel
   * @param {string} toUserId Addressee of the invite
   * @param {string} toUserId Addresser of the invite
   * @param {string} messageId Message id
   * @param {string} workspaceId In which workspace invite is sending
   * @param {string} channelId Invite in channel id
   * @param {boolean} isResponseNeeded Should the addresseee send a respond
   * @param {object} message Free message object
   */
  sendInvite({
    toUserId,
    fromUserId,
    messageId,
    workspaceId,
    channelId,
    isResponseNeeded,
    message
  }) {
    this.server.apiEvents.emit('api-event', {
      data: {
        inviteId: messageId,
        isResponseNeeded,
        userId: fromUserId,
        workspaceId,
        channelId,
        message
      },
      name: eventNames.socket.invite,
      room: eventNames.rooms.userRoom(toUserId)
    });
  }

  /**
   * Api event about message without response
   * @param {string} toUserId Who is not receiving respond
   * @param {string} fromUserId Who is not sending respond
   * @param {string} messageId Message id
   */
  noInviteResponse(toUserId, fromUserId, messageId) {
    this.server.apiEvents.emit('api-event', {
      data: {
        response: 'no-response',
        inviteId: messageId,
        userId: fromUserId
      },
      name: eventNames.socket.inviteResponse,
      room: eventNames.rooms.userRoom(toUserId)
    });
  }

  /**
   * Api event about response for message
   * @param {string} toUserId Addressee of response
   * @param {string} fromUserId Addresser of response
   * @param {string} messageId Message id of response
   * @param {object} response Free response object
   */
  inviteResponse(toUserId, fromUserId, messageId, response) {
    this.server.apiEvents.emit('api-event', {
      data: {
        userId: fromUserId,
        inviteId: messageId,
        response
      },
      name: eventNames.socket.inviteResponse,
      room: eventNames.rooms.userRoom(toUserId)
    });
  }

  /**
   * Send event for cancelling and deleting specific invite
   * @param {string} toUserId Which user should cancel an invite 
   * @param {string} inviteId Invite id
   */
  inviteCancelled(toUserId, inviteId) {
    this.server.apiEvents.emit('api-event', {
      data: {
        inviteId: inviteId
      },
      name: eventNames.socket.inviteCancelled,
      room: eventNames.rooms.userRoom(toUserId)
    });
  }

  /**
   * Send event about muting the user for all
   * @param {string} fromUserId Who send command of muting
   * @param {string} toUserId Who should receiver command
   * @param {string} socketId socket id of receiver
   */
  mutedForAll(fromUserId, toUserId, socketId) {
    this.server.apiEvents.emit('api-event', {
      data: {
        fromUserId,
        socketId
      },
      name: eventNames.socket.mutedForAll,
      room: eventNames.rooms.userRoom(toUserId)
    });
  }

  /**
   * Api event about channel updated
   * @param {string} channelId Channel id
   * @param {object} channelInfo Channel info from db
   */
  channelUpdated(channelId, channelInfo) {
    const { displayService } = this.server.services();

    this.server.apiEvents.emit('api-event', {
      data: {
        channel: displayService.channel(channelInfo)
      },
      name: eventNames.socket.channelUpdated,
      room: eventNames.rooms.channelRoom(channelId)
    });
  }

  /**
   * Api event about user was kicked from the workspace
   * @param {string} userId Which user was kicked
   * @param {string} workspaceId What workspace
   */
  userKickedFromWorkspace(userId, workspaceId) {
    this.server.apiEvents.emit('api-event', {
      data: {
        workspaceId
      },
      name: eventNames.socket.kickedFromWorkspace,
      room: eventNames.rooms.userRoom(userId),
    });
  }

  /**
   * Broadcast events within a conversation
   * 
   * @param {string} channelId Channel id
   * @param {object} data Any client data
   */
  conversationBroadcast(channelId, data) {
    this.server.apiEvents.emit('api-event', {
      data: {
        channelId,
        data
      },
      name: eventNames.socket.conversationBroadcast,
      room: eventNames.rooms.conversationRoom(channelId),
    });
  }
};
