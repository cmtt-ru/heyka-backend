/* eslint-disable camelcase */
'use strict';

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('sessions', {
    access_token: {
      type: 'uuid',
      primaryKey: true
    },
    refresh_token: {
      type: 'uuid',
      primaryKey: true
    },
    user_id: {
      type: 'uuid',
      references: 'users(id)',
      onDelete: 'cascade'
    },
    session_info: 'jsonb',
    created_at: 'timestamp',
    refreshed_at: 'timestamp',
    expired_at: 'timestamp'
  });
};

exports.down = (pgm) => {
  pgm.dropTable('sessions', { cascade: true });
};
