/* eslint-disable camelcase */
'use strict';

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('janus_stats', {
    id: {
      type: 'uuid',
      primaryKey: true
    },
    workspace_id: {
      type: 'uuid',
      references: 'workspaces(id)',
      onDelete: 'cascade'
    },
    body: 'text',
    created_at: 'timestamptz',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('janus_stats', { cascade: true });
};
