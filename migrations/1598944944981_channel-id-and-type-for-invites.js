/* eslint-disable camelcase */
'use strict';

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumns('invites', {
    channel_id: {
      type: 'uuid',
      references: 'channels(id)',
      onDelete: 'cascade'
    },
    type: 'varchar(20)'
  });
  pgm.addColumns('users', {
    invite_id: {
      type: 'uuid',
      references: 'invites(id)',
      onDelete: 'set null',
    }
  });
};

exports.down = (pgm) => {
  pgm.dropColumns('invites', ['channel_id', 'type']);
  pgm.dropColumns('users', ['invite_id']);
};
