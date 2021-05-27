/* eslint-disable camelcase */
'use strict';

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('groups', {
    id: {
      type: 'uuid',
      primaryKey: true
    },
    workspace_id: {
      type: 'uuid',
      references: 'workspaces(id)',
      onDelete: 'cascade'
    },
    creator_id: {
      type: 'uuid',
      references: 'users(id)',
      onDelete: 'set null'
    },
    name: 'varchar(255)',
    created_at: 'timestamp',
    updated_at: 'timestamp',
  });
  pgm.createTable('groups_members', {
    workspace_id: {
      type: 'uuid',
      primaryKey: true,
      references: 'workspaces(id)',
      onDelete: 'cascade'
    },
    group_id: {
      type: 'uuid',
      primaryKey: true,
      references: 'groups(id)',
      onDelete: 'cascade'
    },
    user_id: {
      type: 'uuid',
      primaryKey: true,
      references: 'users(id)',
      onDelete: 'cascade'
    },
    created_at: 'timestamp',
    updated_at: 'timestamp'
  });
};

exports.down = (pgm) => {
  pgm.dropTable('groups');
  pgm.dropType('groups_members');
};
