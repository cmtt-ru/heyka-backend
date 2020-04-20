'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const Joi = require('@hapi/joi');
const schemas = require('../../schemas');

const responseSchema = Joi.object({
  userMediaStates: Joi.array().items(schemas.userMediaStateWithId).required(),
  connectionOptions: {
    janusServerUrl: Joi.string().uri().required(),
    janusAuthToken: Joi.string().required(),
    audioRoomId: Joi.number().required(),
    videoRoomId: Joi.number().required(),
    channelAuthToken: Joi.string().required()
  }
}).label('Select channel info');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/channels/{channelId}/select',
  options: {
    tags: ['api', 'channels'],
    description: 'Select a certain channel',
    validate: {
      query: Joi.object({
        socketId: Joi.string().required()
      }),
      payload: schemas.userMediaState
    },
    response: {
      failAction: 'error',
      schema: responseSchema
    }
  },
  handler: async (request, h) => {
    const {
      channelService,
      channelDatabaseService: chdb,
      workspaceDatabaseService: wdb
    } = request.services();
    const { userId } = request.auth.credentials;
    const { channelId } = request.params;
    const { socketId } = request.query;
    
    try {
      const canSelect = await channelService.canSelectChannel(channelId, userId);

      if (!canSelect) {
        return Boom.forbidden('UserCanNotSelectChannel');
      }

      const channelWithRelation = await chdb.getChannelWithRelation(channelId, userId);
      const workspaceWithRelation = await wdb.getWorkspaceWithRelation(channelWithRelation.workspace_id, userId);
      await channelService.selectChannel(channelId, userId, socketId, request.payload);
      const userMediaStates = await channelService.usersMediaStateInChannel(channelId);

      const result = {
        userMediaStates,
        connectionOptions: {
          janusServerUrl: workspaceWithRelation.janus.public_url,
          janusAuthToken: workspaceWithRelation.janus_auth_token,
          audioRoomId: channelWithRelation.janus.audioRoomId,
          videoRoomId: channelWithRelation.janus.videoRoomId,
          channelAuthToken: channelWithRelation.janus_auth_token
        }
      };
      // console.log(responseSchema.validate(result));
      return result;
    } catch (e) {
      request.log(['debug-error'], 'Error on select channel by user: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
