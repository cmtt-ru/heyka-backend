/* eslint-disable camelcase */
'use strict';

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('users', {
    id: {
      type: 'uuid',
      primaryKey: true
    },
    auth: 'jsonb',
    email: {
      type: 'varchar(255)',
      unique: true,
    },
    password_hash: 'text',
    password_salt: 'text',
    created_at: 'timestamptz',
    updated_at: 'timestamptz'
  });
};

exports.down = (pgm) => {
  pgm.dropTable('users', { cascade: true });
};
