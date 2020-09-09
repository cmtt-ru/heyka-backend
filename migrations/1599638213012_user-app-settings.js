'use strict';
/* eslint-disable camelcase */

/**
 * This migration was added with task https://cmtt-ru.atlassian.net/browse/HEYK-361
 * 
 * Added `app_settings` field to the `users` table in postgresql for
 * storing and synchronization desktop application settings
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumns('users', {
    app_settings: {
      type: 'jsonb'
    }
  });
};

exports.down = (pgm) => {
  pgm.dropColumns('users', ['app_settings']);
};
