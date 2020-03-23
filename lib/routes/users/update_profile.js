'use strict';

const Helpers = require('../helpers');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');
const schemas = require('../../schemas');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/profile',
  options: {
    tags: ['api', 'user'],
    description: 'Update user profile',
    validate: {
      payload: Joi.object({
        name: Joi.string().max(100).required(),
        avatar: Joi.string().uri().required()
      }).label('UpdateProfileInfo')
    },
    response: {
      failAction: 'error',
      schema: schemas.user
    }
  },
  handler: async (request, h) => {
    const { userId } = request.auth.credentials;
    const { userService, displayService } = request.services();
    const updateInfo = request.payload;
    
    try {
      const user = await userService.updateProfile(userId, updateInfo);

      return displayService.user(user);
    } catch (e) {
      request.log(['debug-error'], 'Error on update user profile: ', e);
      return Boom.internal();
    }
  }
});
