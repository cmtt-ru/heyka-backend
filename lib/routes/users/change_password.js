'use strict';

const Helpers = require('../helpers');
const Joi = require('@hapi/joi');
const Boom = require('@hapi/boom');

module.exports = Helpers.withDefaults({
  method: 'POST',
  path: '/password',
  options: {
    tags: ['api', 'user'],
    description: 'Update user password',
    validate: {
      payload: Joi.object({
        oldPassword: Joi.string().min(4).optional()
          .description('Can be empty if password has not been set'),
        password: Joi.string().min(4).required(),
      }),
    },
  },
  handler: async (request, h) => {
    const { userId } = request.auth.credentials;
    const { userService } = request.services();
    const { oldPassword, password } = request.payload;
    
    try {
      await userService.updatePassword(userId, oldPassword, password);

      return 'ok';
    } catch (e) {
      if (e.message === 'InvalidPassword') {
        return Boom.unauthorized('Invalid password');
      }

      console.log(['debug-error'], 'Error on update user profile: ', e);
      return Boom.internal();
    }
  }
});
