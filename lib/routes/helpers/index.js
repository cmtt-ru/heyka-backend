'use strict';

const Toys = require('toys');

exports.withDefaults = Toys.withRouteDefaults({
  options: {
    auth: 'simple'
  }
});

/**
 * Capitalize the first letter in string
 * @param {string} str String to capitalize
 * @returns {string}
 */
exports.capitalize = str => str.charAt(0).toUpperCase() + str.slice(1);
