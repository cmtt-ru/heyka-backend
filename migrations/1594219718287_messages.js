/* eslint-disable camelcase */
'use strict';

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('messages', {
    id: {
      type: 'uuid',
      primaryKey: true
    },
    from_user_id: {
      type: 'uuid',
      references: 'users(id)',
      onDelete: 'cascade'
    },
    to_user_id: {
      type: 'uuid',
      references: 'users(id)',
      onDelete: 'cascade'
    },
    workspace_id: {
      type: 'uuid',
      references: 'workspaces(id)',
      onDelete: 'cascade'
    },
    channel_id: {
      type: 'uuid',
      references: 'channels(id)',
      onDelete: 'cascade'
    },
    data: 'jsonb',
    created_at: 'timestamptz',
    updated_at: 'timestamptz'
  });
};

exports.down = (pgm) => {
  pgm.dropTable('messages');
};
