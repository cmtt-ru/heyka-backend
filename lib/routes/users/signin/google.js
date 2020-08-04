'use strict';

const Helpers = require('../../helpers');
const Boom = require('@hapi/boom');
const errorMessages = require('../../../error_messages');

/* Add square brackets because of two methods for that route (see https://github.com/hapipal/discuss/issues/3) */
module.exports = [Helpers.withDefaults({
  method: ['GET'],
  path: '/signin/google',
  options: {
    auth: 'google',
    tags: ['api', 'socialauth'],
    description: 
      'Call the method, redirect user with the provided url and call\
      method encore with result of google authorization.'
  },
  handler: async (request, h) => {
    const {
      userService,
      userDatabaseService: udb
    } = request.services();

    if (!request.auth.isAuthenticated) {
      return h.redirect(`/auth/social/callback&success=false&error=${request.auth.error.message}`);
    }

    let authedUserId = null;

    try {
      const accessToken = request.state['heyka-access-token'];
      if (accessToken) {
        const { result, tokenInfo } = await userService.isTokenValid(accessToken);
        authedUserId = result ? tokenInfo.userId : null;
      }
    } catch(e) {
      authedUserId = null;
    }

    try {
      let user = await userService.findByExternalAuthenticatorId('google', request.auth.credentials.profile.id);

      // Запрос не авторизован, просто создаём новый аккаунт
      if (!user && !authedUserId) {
        user = await userService.signup({
          name: request.auth.credentials.profile.displayName,
          auth: {
            google: {
              id: request.auth.credentials.profile.id,
              ...request.auth.credentials.profile
            }
          }
        });
      // Запрос был авторизован, и юзера с таким social-auth не существует, привязываем 
      } else if (!user && authedUserId) {
        user = await udb.findById(authedUserId);

        if (!user) {
          return Boom.internal();
        }

        // Если у юзера привязан аккаунт гугла
        if (user.auth.google) {
          return Boom.badRequest(errorMessages.serviceAlreadyAttached);
        }

        const updateUser = {
          auth: {
            ...user.auth,
            google: {
              id: request.auth.credentials.profile.id,
              ...request.auth.credentials.profile
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
      
      if (authedUserId) {
        return h.redirect('/auth/social/callback?success=true');
      } else {
        const code = await userService.createAuthLink(user.id);
        return h.redirect(`/auth/social/callback?success=true&authlink=${code}`);
      }
    } catch (e) {
      request.log(['debug-error'], 'Error on login user by google: ' + e);
      return Boom.internal();
    }
  }
})];
