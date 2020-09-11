/* eslint-disable camelcase */
'use strict';

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumns('workspaces_members', {
    invite_id: {
      type: 'uuid',
      references: 'invites(id)',
      onDelete: 'set null'
    },
  });
  pgm.addColumns('channels_members', {
    invite_id: {
      type: 'uuid',
      references: 'invites(id)',
      onDelete: 'set null',
    }
  });
};

exports.down = (pgm) => {
  pgm.dropColumns('workspaces_members', ['invite_id']);
  pgm.dropColumns('channels_members', ['invite_id']);
};
