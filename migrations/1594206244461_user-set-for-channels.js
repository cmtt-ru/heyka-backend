/* eslint-disable camelcase */
'use strict';

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumns('channels', {
    user_set: {
      type: 'varchar(255)'
    }
  });
  pgm.createIndex('channels', ['user_set']);
};

exports.down = (pgm) => {
  pgm.dropIndex('channels', ['user_set']);
  pgm.dropColumns('channels', ['user_set']);
};
