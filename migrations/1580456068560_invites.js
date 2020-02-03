/* eslint-disable camelcase */
'use strict';

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('invites', {
    id: {
      type: 'uuid',
      primaryKey: true
    },
    created_by: {
      type: 'uuid',
      references: 'users(id)',
      onDelete: 'cascade'
    },
    workspace_id: {
      type: 'uuid',
      references: 'workspaces(id)',
      onDelete: 'cascade'
    },
    code: 'varchar(50)',
    created_at: 'timestamp',
    updated_at: 'timestamp',
    expired_at: 'timestamp'
  });
};

exports.down = (pgm) => {
  pgm.dropTable('invites');
};
