'use strict';

/**
 * This file defines amendments for hapipal/haute-cauter library according to the
 * documentation https://github.com/hapipal/haute-couture/blob/master/API.md
 */
module.exports = {
  recursive: true,
  /**
   * exclude "helpers",
   * "socker" direcrories
   * and file "schemas"
   */
  exclude: function (filename, path) {
    return path.match(/^helpers\/?.*/) 
    || path.match(/^socket\/?.*/)
    || path.match(/^schemas\.js$/)
    || path.match(/\.json$/)
    || path.includes('mailgun.js') // exlcude MailgunWrapper
    || path.match(/social_signin_route\.js$/)
  }
};
