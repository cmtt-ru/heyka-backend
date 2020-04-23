'use strict';

const Helpers = require('../helpers');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');
const schemas = require('../../schemas');
const errorMessages = require('../../error_messages');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/profile',
  options: {
    tags: ['api', 'user'],
    description: 'Update user profile',
    validate: {
      payload: Joi.object({
        name: Joi.string().max(100).optional(),
        avatar: Joi.string().uri().optional()
      }).label('UpdateProfileInfo')
    },
    response: {
      failAction: 'error',
      status: {
        200: schemas.user,
        404: Joi.any().example(Boom.notFound(errorMessages.notFound).output.payload)
          .description('User is not found')
      }
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
      if (e.message === 'UserNotFound') {
        return Boom.notFound(errorMessages.notFound);
      }
      request.log(['debug-error'], 'Error on update user profile: ', e);
      return Boom.internal();
    }
  }
});
