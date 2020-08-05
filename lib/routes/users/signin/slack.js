'use strict';

const Helpers = require('../../helpers');
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
      userDatabaseService: udb,
    } = request.services();

    if (!request.auth.isAuthenticated) {
      return h.redirect(`/auth/social/callback?success=false&error=${request.auth.error.message}`);
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
      let user = await userService.findByExternalAuthenticatorId('slack', request.auth.credentials.params.user_id);

      // Запрос не авторизован, просто создаём новый аккаунт
      if (!user && !authedUserId) {
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
        user = await udb.findById(authedUserId);

        if (!user) {
          return h.redirect(`/auth/social/callback?success=false&error=${errorMessages.internalError}`);
        }

        // Если у юзера привязан аккаунт слэка
        if (user.auth.slack) {
          return h.redirect(`/auth/social/callback?success=false&error=${errorMessages.serviceAlreadyAttached}`);
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
          return h.redirect(`/auth/social/callback?success=false&error=${errorMessages.accountAlreadyAttached}`);
        } else if (authedUserId && user.id !== authedUserId) {
          // Аккаунт прикреплен к другому юзеру
          return h.redirect(`/auth/social/callback?success=false&error=${errorMessages.alreadyAttachedAnotherUser}`);
        }
      }
      
      if (authedUserId) {
        return h.redirect('/auth/social/callback?success=true');
      } else {
        const code = await userService.createAuthLink(user.id);
        return h.redirect(`/auth/social/callback?success=true&authlink=${code}`);
      }
    } catch (e) {
      request.log(['debug-error'], 'Error on login user by slack: ' + e);
      return h.redirect(`/auth/social/callback?success=false&error=${errorMessages.internalError}`);
    }
  }
})];
