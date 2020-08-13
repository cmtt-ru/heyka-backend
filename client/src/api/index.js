import axios from 'axios';
import authApi from './auth';
import workspaceApi from './workspace';
import adminApi from './admin';
import { errorMessages } from './errors/types';
import { handleError } from './errors';
import { updateTokens, checkAndRefreshTokens } from './tokens';

if (IS_DEV) {
  axios.defaults.baseURL = process.env.VUE_APP_DEV_URL;
}

/**
 * Inject's middleware function in all api methods
 *
 * @param {object} functions – object with functions
 * @returns {object}
 */
function injectMiddleware(functions) {
  Object.keys(functions).forEach(name => {
    const origFunc = functions[name];

    functions[name] = middleware(origFunc, name);
  });

  return functions;
}

/**
 * Middleware function
 *
 * @param {function} func – specific function
 * @param {string} functionName – function name
 * @returns {function(...[*]=)}
 */
function middleware(func, functionName) {
  return async function () {
    try {
      await checkAndRefreshTokens();

      return await func.apply(null, arguments);
    } catch (err) {
      if (err.response === undefined) {
        await handleError(err);

        return;
      }

      /** Update tokens if token is expired */
      if (err.response.data.message === errorMessages.accessTokenExpired) {
        await updateTokens();

        return middleware(func, functionName).apply(null, arguments);
      }

      /** Global error handler */
      await handleError(err);
    }
  };
}

export default {
  auth: injectMiddleware(authApi),
  workspace: injectMiddleware(workspaceApi),
  admin: injectMiddleware(adminApi),
};
