'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const Joi = require('@hapi/joi');
const schemas = require('../../schemas');
const errorMessages = require('../../error_messages');

const responseSchema = Joi.object({
  connectionOptions: {
    janusServerUrl: Joi.string().uri().required(),
    janusAuthToken: Joi.string().required(),
    audioRoomId: Joi.number().required(),
    videoRoomId: Joi.number().required(),
    channelAuthToken: Joi.string().required()
  }
}).label('SelectChannelInfo');

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
      status: {
        200: responseSchema,
        403: Joi.any().example(Boom.forbidden(errorMessages.accessDenied).output.payload)
          .description('User hasn\'t access to the channel')
      },
      failAction: 'error',
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
        return Boom.forbidden(errorMessages.accessDenied);
      }

      const channelWithRelation = await chdb.getChannelWithRelation(channelId, userId);
      const workspaceWithRelation = await wdb.getWorkspaceWithRelation(channelWithRelation.workspace_id, userId);
      await channelService.selectChannel(channelId, userId, socketId, request.payload);

      const result = {
        connectionOptions: {
          janusServerUrl: workspaceWithRelation.janus.url,
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
