'use strict';
/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumns('sessions', {
    prev_access_token: {
      type: 'string',
      unique: true,
    },
    prev_refresh_token: {
      type: 'string',
      unique: true
    },
  });
};

exports.down = (pgm) => {
  pgm.dropColumns('sessions', ['prev_access_token', 'prev_refresh_token']);
};
