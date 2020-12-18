'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const schemas = require('../../schemas');
const Joi = require('@hapi/joi');
const errorMessages = require('../../error_messages');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/user/media-state',
  options: {
    tags: ['api', 'user'],
    description: 'Change state of the user',
    validate: {
      payload: schemas.userMediaState,
      query: Joi.object({
        socketId: Joi.string().required(),
      })
    },
    response: {
      status: {
        200: Joi.valid('ok')
      }
    }
  },
  handler: async (request, h) => {
    const {
      channelService,
    } = request.services();
    const { userId } = request.auth.credentials;
    const { socketId } = request.query;
    const mediaState = request.payload;

    if (socketId === 'undefined') {
      return Boom.badRequest();
    }

    try {
      await channelService.updateUserMediaState(userId, socketId, mediaState);

      return 'ok';
    } catch (e) {
      if (e.message === 'Unknow connection') {
        return Boom.badRequest(errorMessages.unknowConnection);
      } else if (e.message === 'User hasnt joined any channels') {
        return Boom.badRequest(errorMessages.connectionNotInChannel);
      }
      request.log(['debug-error'], 'Error on updating user media state: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
