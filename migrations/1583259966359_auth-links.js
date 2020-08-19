/* eslint-disable camelcase */
'use strict';

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('auth_links', {
    id: {
      type: 'uuid',
      primaryKey: true
    },
    user_id: {
      type: 'uuid',
      references: 'users(id)',
      onDelete: 'cascade',
    },
    code: 'varchar(50)',
    created_at: 'timestamp',
    updated_at: 'timestamp',
    expired_at: 'timestamp'
  });
};

exports.down = (pgm) => {
  pgm.dropTable('auth_links');
};
