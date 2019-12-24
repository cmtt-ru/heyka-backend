/* eslint-disable camelcase */
'use strict';

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createType('channel_members_roles', ['admin', 'moderator', 'user', 'left']);
  pgm.createTable('channels', {
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
    is_private: {
      type: 'boolean'
    },
    created_at: 'timestamp',
    updated_at: 'timestamp',
    tmp_active_until: 'timestamp'
  });
  pgm.createTable('channels_members', {
    workspace_id: {
      type: 'uuid',
      primaryKey: true,
      references: 'workspaces(id)',
      onDelete: 'cascade'
    },
    channel_id: {
      type: 'uuid',
      primaryKey: true,
      references: 'channels(id)',
      onDelete: 'cascade'
    },
    user_id: {
      type: 'uuid',
      primaryKey: true,
      references: 'users(id)',
      onDelete: 'cascade'
    },
    role: 'channel_members_roles'
  });
};

exports.down = (pgm) => {
  pgm.dropTable('channels_members');
  pgm.dropTable('channels');
  pgm.dropType('channel_members_roles');
};
