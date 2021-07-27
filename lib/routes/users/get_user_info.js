'use strict';

const Helpers = require('../helpers');
const Boom = require('@hapi/boom');
const schemas = require('../../schemas');
const errorMessages = require('../../error_messages');
const Joi = require('@hapi/joi');

module.exports = Helpers.withDefaults({
  method: 'GET',
  path: '/user/{userId}',
  options: {
    tags: ['api', 'user'],
    description: 'Get profile info about user',
    validate: {
      params: Joi.object({
        userId: Joi.string().uuid().required(),
      }),
    },
    response: {
      failAction: 'log',
      status: {
        200: schemas.user,
        404: Joi.any().example(Boom.notFound(errorMessages.notFound).output.payload)
          .description('User not found')
      }
    }
  },
  handler: async (request, h) => {
    const { 
      userDatabaseService: udb,
      displayService,
      permissionService,
    } = request.services();
    const { userId } = request.auth.credentials;
    const { userId: targetUserId } = request.params;

    try {
      const canViewUserInfo = await permissionService.canViewUserInfo(targetUserId, userId);

      if (!canViewUserInfo) {
        return Boom.forbidden();
      }

      const user = await udb.findById(targetUserId);

      if (!user) {
        return Boom.notFound(errorMessages.notFound);
      }

      return displayService.user(user);
    } catch (e) {
      request.log(['debug-error'], 'Error on getting user info: ' + e);
      return Boom.internal();
    }
  }
});
