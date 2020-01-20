/* eslint-disable camelcase */
'use strict';

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createType('workspace_members_roles', ['admin', 'moderator', 'user', 'guest']);
  pgm.createTable('workspaces', {
    id: {
      type: 'uuid',
      primaryKey: true
    },
    name: 'varchar(255)',
    avatar: 'text',
    janus: 'jsonb',
    created_at: 'timestamp',
    updated_at: 'timestamp',
    limits: 'jsonb'
  });
  pgm.createTable('workspaces_members', {
    workspace_id: {
      type: 'uuid',
      references: 'workspaces(id)',
      onDelete: 'cascade',
      primaryKey: true
    },
    user_id: {
      type: 'uuid',
      references: 'users(id)',
      onDelete: 'cascade',
      primaryKey: true
    },
    created_at: 'timestamp',
    updated_at: 'timestamp',
    role: 'workspace_members_roles'
  });
};

exports.down = (pgm) => {
  pgm.dropTable('workspaces_members');
  pgm.dropTable('workspaces');
  pgm.dropType('workspace_members_roles');
};
