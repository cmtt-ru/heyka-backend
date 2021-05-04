'use strict';
/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumns('users', {
    platform_endpoints: {
      type: 'jsonb'
    }
  });
};

exports.down = (pgm) => {
  pgm.dropColumns('users', ['platform_endpoints']);
};
