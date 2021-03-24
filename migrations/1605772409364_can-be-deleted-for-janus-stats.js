/* eslint-disable camelcase */
'use strict';

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumns('janus_stats', {
    do_not_delete: 'boolean'
  });
};

exports.down = (pgm) => {
  pgm.dropColumns('janus_stats', ['do_not_delete']);
};
