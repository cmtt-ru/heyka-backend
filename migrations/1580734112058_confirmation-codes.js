/* eslint-disable camelcase */
'use strict';

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('confirmation_codes', {
    id: {
      type: 'uuid',
      primaryKey: true
    },
    email: 'varchar(255)',
    code: 'varchar(50)',
    user_id: {
      type: 'uuid',
      references: 'users(id)',
      onDelete: 'cascade'
    },
    created_at: 'timestamp',
    updated_at: 'timestamp',
    expired_at: 'timestamp'
  });
};

exports.down = (pgm) => {
  pgm.dropTable('confirmation_codes');
};
