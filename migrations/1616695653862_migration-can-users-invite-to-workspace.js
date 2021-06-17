/* eslint-disable camelcase */
'use strict';

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumns('workspaces', {
    can_users_invite: {
      type: 'boolean',
    },
  });
};

exports.down = (pgm) => {
  pgm.dropColumns('workspaces', ['can_users_invite']);
};
