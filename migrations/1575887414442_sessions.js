/* eslint-disable camelcase */
'use strict';

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('sessions', {
    id: {
      type: 'uuid',
      primaryKey: true
    },
    access_token: {
      type: 'string',
      unique: true,
    },
    refresh_token: {
      type: 'string',
      unique: true
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
