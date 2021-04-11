'use strict';
/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumns('messages', {
    push_endpoints: {
      type: 'text[]'
    }
  });
};

exports.down = (pgm) => {
  pgm.dropColumns('messages', ['push_endpoints']);
};
