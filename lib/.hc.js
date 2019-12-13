'use strict';

/**
 * This file defines amendments for hapipal/haute-cauter library according to the
 * documentation https://github.com/hapipal/haute-couture/blob/master/API.md
 */
module.exports = {
  recursive: true,
  // exclude the "helpers" and "socket" folder from registration
  exclude: function (filename, path) {
    return path.match(/^helpers\/?.*/) || path.match(/^socket\/?.*/);
  }
};
