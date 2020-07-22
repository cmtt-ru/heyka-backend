/* eslint-disable camelcase */
'use strict';

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumns('channels', {
    is_tmp: {
      type: 'boolean',
      default: 'false'
    }
  });
};

exports.down = (pgm) => {
  pgm.dropColumns('channels', ['is_tmp']);
};
