/* eslint-disable camelcase */

/**
 * Created for task https://cmtt-ru.atlassian.net/browse/HEYK-410
 * 
 * Adding users usage count for channels
 * And adding calls count between users
 */

'use strict';

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumns('channels_members', {
    usage_count: {
      type: 'int',
      default: 0,
      notNull: true,
    },
    latest_usage: 'timestamptz',
  });
  pgm.createTable('user_relations', {
    user1: {
      type: 'uuid',
      references: 'users(id)',
      onDelete: 'cascade'
    },
    user2: {
      type: 'uuid',
      references: 'users(id)',
      onDelete: 'cascade'
    },
    workspace_id: {
      type: 'uuid',
      references: 'workspaces(id)',
      onDelete: 'cascade'
    },
    calls_count: {
      type: 'int',
      default: 0,
      notNull: true,
    },
    latest_call: 'timestamptz',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('user_relations', { cascade: true });
  pgm.dropColumns('channels_members', ['usage_count', 'latest_usage']);
};
