'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const Joi = require('@hapi/joi');
const schemas = require('../../schemas');
const errorMessages = require('../../error_messages');

const responseSchema = Joi.object({
  connectionOptions: {
    janusServerUrl: Joi.string().uri().required(),
    janusWsServerUrl: Joi.string().uri().required(),
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
      permissionService
    } = request.services();
    const { userId } = request.auth.credentials;
    const { channelId } = request.params;
    const { socketId } = request.query;
    
    try {
      const canSelect = await permissionService.canSelectChannel(channelId, userId);

      if (!canSelect) {
        return Boom.forbidden(errorMessages.accessDenied);
      }

      const canSelectByLimit = await permissionService.canSelectChannelByLimit(channelId);

      if(!canSelectByLimit){
        return Boom.badRequest(errorMessages.limitExceeded);
      }

      const janusOpts = await channelService.selectChannel(channelId, userId, socketId, request.payload);

      const result = {
        connectionOptions: {
          janusServerUrl: janusOpts.httpsUrl,
          janusWsServerUrl: janusOpts.wssUrl,
          janusAuthToken: janusOpts.serverAuthToken,
          audioRoomId: janusOpts.audioRoomId,
          videoRoomId: janusOpts.videoRoomId,
          channelAuthToken: janusOpts.channelAuthToken
        }
      };
      return result;
    } catch (e) {
      if (e.message.includes('ConnectionNotFound')) {
        return Boom.badRequest(errorMessages.socketNotFound);
      } else if (e.message.includes('ChannelAlreadySelected')) {
        return Boom.badRequest(errorMessages.channelAlreadySelected);
      }
      request.log(['debug-error'], 'Error on select channel by user: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
