'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const schemas = require('../../schemas');
const Joi = require('@hapi/joi');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/user/media-state',
  options: {
    tags: ['api', 'users'],
    description: 'Change state of the user',
    validate: {
      payload: schemas.userMediaState,
      query: Joi.object({
        socketId: Joi.string().required()
      })
    }
  },
  handler: async (request, h) => {
    const {
      channelService,
    } = request.services();
    const { userId } = request.auth.credentials;
    const { socketId } = request.query;
    const mediaState = request.payload;

    try {
      await channelService.updateUserMediaState(userId, socketId, mediaState);

      return 'ok';
    } catch (e) {
      request.log(['debug-error'], 'Error on updating user media state: ' + e + e.stack);
      return Boom.internal();
    }
  }
});
