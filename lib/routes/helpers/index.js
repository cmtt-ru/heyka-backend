'use strict';

const Toys = require('toys');

exports.withDefaults = Toys.withRouteDefaults({
  options: {
    auth: 'simple'
  }
});
