'use strict';
/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumns('users', {
    device_tokens: {
      type: 'text[]'
    }
  });
};

exports.down = (pgm) => {
  pgm.dropColumns('users', ['device_tokens']);
};
