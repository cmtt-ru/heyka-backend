/* eslint-disable camelcase */
'use strict';

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumns('channels', {
    description: 'text',
  });
};

exports.down = (pgm) => {
  pgm.dropColumns('channels', ['description']);
};
