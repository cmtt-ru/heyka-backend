/* eslint-disable camelcase */
'use strict';

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('stats', {
    id: {
      type: 'uuid',
      primaryKey: true
    },
    user_id: {
      type: 'uuid',
      references: 'users(id)',
      onDelete: 'cascade'
    },
    mean_bitrate: 'real',
    janus_server_url: 'varchar(255)',
    connection_info: 'jsonb',
    created_at: 'timestamptz',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('stats', { cascade: true });
};
