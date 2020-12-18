'use strict';
/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumns('users', {
    online_status: {
      type: 'varchar(20)'
    }
  });
};

exports.down = (pgm) => {
  pgm.dropColumns('users', ['online_status']);
};
