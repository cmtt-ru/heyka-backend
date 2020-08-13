/* eslint-disable camelcase */
'use strict';

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumns('users', {
    avatar_set: 'jsonb',
    avatar_file_id: {
      type: 'uuid',
      references: 'files(id)'
    }
  });
};

exports.down = (pgm) => {
  pgm.dropColumns('users', ['avatar_set', 'avatar_file_id']);
};
