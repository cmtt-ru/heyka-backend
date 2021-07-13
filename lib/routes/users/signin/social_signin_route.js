'use strict';

const Boom = require('@hapi/boom');
const uuid = require('uuid/v4');
const Helpers = require('../../helpers');
const errorMessages = require('../../../error_messages');
const config = require('../../../../config');


const REDIRECT_URL = `${process.env.LOCALLY ? 'http' : 'https'}://${config.publicHostname}/auth/social/callback`;

const defaultAdditionalDataExtractor = function (creds) {
  return {
    ...creds
  };
};

/**
 * @callback idExtractor
 * @param {object} credentials Credentials object
 * @returns {(string|number)} External accound id
 * 
 * @callback nameExtractor
 * @param {object} credentials Credentials object
 * @returns {string} External name
 * 
 * @callback additionalDataExtractor
 * @param {object} credentials Credentials object
 * @returns {object} Additional data from external object
 * 
 * @param {object} config Social singin route options
 * @param {string} config.service What is external service
 * @param {idExtractor} config.idExtractor
 * @param {nameExtractor} config.nameExtractor
 * @param {?additionalDataExtractor} config.additionalDataExtractor
 * @returns {HapiRoute}
 */
module.exports = function createSocialSigninRoute({
  service,
  idExtractor,
  nameExtractor,
  additionalDataExtractor = defaultAdditionalDataExtractor,
  avatarExtractor
}) {
  return [Helpers.withDefaults({
    method: ['GET'],
    path: `/signin/${service}`,
    options: {
      auth: service,
      tags: ['api', 'socialauth'],
      description: 
        `Call the method, redirect user with the provided url and call method \
        encore with result of ${service} authorization.`
    },
    handler: async function (request, h) {
      const {
        fileService,
        userService,
        userDatabaseService: udb,
        apiEventService,
      } = request.services();

      const creds = request.auth.credentials;


      const langFromHeaders = request.headers['accept-language'];

      console.log('langFromHeaders>>>>>>>>>>>>>>>>>>>>>>>>>>>>>!!!',langFromHeaders);

      const externalId = idExtractor(creds);
      const externalName = nameExtractor(creds);
      const externalAvatarUrl = avatarExtractor(creds);

      console.log('creds >>>>>>>>>>>>', JSON.stringify(creds, null, 2));

      // callback url
      const action = request.state['heyka-auth-action'];
      let cbUrl = `${REDIRECT_URL}?s=${service}`;
      if (action) {
        cbUrl += '&action=' + action;
      }
  
      if (!request.auth.isAuthenticated) {
        return h.redirect(`${cbUrl}&success=false&error=${request.auth.error.message}`);
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
        let user = await userService.findByExternalAuthenticatorId(service, externalId);

        const avatarFileId = uuid();

        const fileName =  await fileService.uploadS3FromUrl(externalAvatarUrl, avatarFileId );

        const avatarSet = await fileService.getImgproxyImageSet('avatar', fileName);

        console.log('avatarSet >>>>>>>>>>>>>>',avatarSet);
        
        // Запрос не авторизован, просто создаём новый аккаунт
        if (!user && !authedUserId) {
          user = await userService.signup({

            lang: langFromHeaders,
            avatarFileId,
            avatarSet,
            name: externalName,
            auth: {
              [service]: {
                id: externalId,
                ...additionalDataExtractor(creds)
              }
            }
          });
          const code = await userService.createAuthLink(user.id);
          return h.redirect(`${cbUrl}&success=true&newUser=1&authlink=${code}`);


        // Запрос был авторизован, и юзера с таким social-auth не существует, привязываем 
        } else if (!user && authedUserId) {
          user = await udb.findById(authedUserId);
  
          if (!user) {
            return h.redirect(`${cbUrl}&success=false&error=${errorMessages.internalError}`);
          }
  
          // Если у юзера привязан аккаунт этого сервиса
          if (user.auth && user.auth[service]) {
            return h.redirect(`${cbUrl}&success=false&error=${errorMessages.serviceAlreadyAttached}`);
          }


          let updateUser = {
            auth: {
              ...user.auth,
              [service]: {
                id: externalId,
                ...additionalDataExtractor(creds)
              }
            }
          };

          // Если у юзера нет аватарки, ставим аватарку из соцсети

          
          if(!user.avatarSet){
            updateUser.avatarSet = avatarSet;
            updateUser.avatarFileId = avatarFileId;

          }
  
          await udb.updateUser(authedUserId, updateUser);

          apiEventService.meUpdated(user.id, {
            ...user,
            ...updateUser
          }, 'social-auth');
  
        } else if (user) {
          // Аккаунт уже прикреплен к текущему юзеру
          if (user.id === authedUserId) {
            return h.redirect(`${cbUrl}&success=false&error=${errorMessages.accountAlreadyAttached}`);
          } else if (authedUserId && user.id !== authedUserId) {
            // Аккаунт прикреплен к другому юзеру
            return h.redirect(`${cbUrl}&success=false&error=${errorMessages.alreadyAttachedAnotherUser}`);
          }
        }
        
        if (authedUserId) {
          return h.redirect(`${cbUrl}&success=true`);
        } else {
          const code = await userService.createAuthLink(user.id);
          return h.redirect(`${cbUrl}&success=true&authlink=${code}`);
        }
      } catch (e) {
        if (e.message === 'MediaType is not supported!') {
          return Boom.badRequest(errorMessages.mediaTypeNotSupported);
        } else if(e.message === 'Download error') {
          return Boom.badRequest(errorMessages.downloadImageError);
        }
        console.log(e);
        request.log(['debug-error'], 'Error on upload user image: ', e);

        // return Boom.internal();
        
        request.log(['debug-error'], `Error on login user by ${service}: ` + e);
        return h.redirect(`${cbUrl}&success=false&error=${errorMessages.internalError}`);
      }
    }
  })];
};
