'use strict';
/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumns('invites', {
    email: {
      type: 'varchar(255)',
    },
    disabled: 'boolean',
  });
};

exports.down = (pgm) => {
  pgm.dropColumns('invites', ['email', 'disabled']);
};
