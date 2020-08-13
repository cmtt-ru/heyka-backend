/* eslint-disable camelcase */
'use strict';

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('files', {
    id: {
      type: 'uuid',
      primaryKey: true
    },
    filename: 'varchar(255)',
    type: 'varchar(30)',
    user_id: {
      type: 'uuid',
      references: 'users(id)',
      onDelete: 'cascade'
    },
    created_at: 'timestamp',
    updated_at: 'timestamp',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('files');
};
