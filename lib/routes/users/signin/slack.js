'use strict';

const Helpers = require('../../helpers');
const Boom = require('@hapi/boom');
const errorMessages = require('../../../error_messages');

/* Add square brackets because of two methods for that route (see https://github.com/hapipal/discuss/issues/3) */
module.exports = [Helpers.withDefaults({
  method: ['GET'],
  path: '/signin/slack',
  options: {
    auth: 'slack',
    tags: ['api', 'socialauth'],
    description: 
      'Call the method, redirect user with the provided url and call method\
       encore with result of slack authorization.'
  },
  handler: async (request, h) => {
    const {
      userService,
      displayService,
      userDatabaseService: udb,
    } = request.services();

    if (!request.auth.isAuthenticated) {
      return Boom.unauthorized(request.auth.error.message);
    }

    let authedUserId = null;

    try {
      const { credentials } = await request.server.auth.test('default', request);
      authedUserId = credentials.userId;
    } catch(e) {
      authedUserId = null;
    }

    try {
      let newUser = false;
      let user = await userService.findByExternalAuthenticatorId('slack', request.auth.credentials.user_id);

      // Запрос не авторизован, просто создаём новый аккаунт
      if (!user && !authedUserId) {
        newUser = true;
        user = await userService.signup({
          name: request.auth.credentials.params.user.name,
          auth: {
            slack: {
              id: request.auth.credentials.params.user_id,
              ...request.auth.credentials
            }
          }
        });
      // Запрос был авторизован, и юзера с таким social-auth не существует, привязываем 
      } else if (!user && authedUserId) {
        newUser = false;
        user = await udb.findById(authedUserId);

        if (!user) {
          return Boom.internal();
        }

        // Если у юзера привязан аккаунт слэка
        if (user.auth.slack) {
          return Boom.badRequest(errorMessages.serviceAlreadyAttached);
        }

        const updateUser = {
          auth: {
            ...user.auth,
            slack: {
              id: request.auth.credentials.params.user_id,
              ...request.auth.credentials
            }
          }
        };

        await udb.updateUser(authedUserId, updateUser);

      } else if (user) {
        // Аккаунт уже прикреплен к текущему юзеру
        if (user.id === authedUserId) {
          return Boom.badRequest(errorMessages.accountAlreadyAttached);
        } else {
          // Аккаунт прикреплен к другому юзеру
          return Boom.badRequest(errorMessages.alreadyAttachedAnotherUser);
        }
      }
      
      const tokens = await userService.createTokens(user);
  
      const result = {
        user: displayService.userWithConfidentialData(user),
        credentials: tokens,
        newUser
      };

      if (newUser) {
        result.predefinedData = {
          email: request.auth.credentials.params.user.email,
          avatar: request.auth.credentials.params.user.image_512
        };
      }

      return result;
    } catch (e) {
      request.log(['debug-error'], 'Error on login user by slack: ' + e);
      return Boom.internal();
    }
  }
})];
