/* eslint-disable camelcase */
'use strict';

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addTypeValue('workspace_members_roles', 'super_admin');
};

exports.down = (pgm) => {
  pgm.dropType('workspace_members_roles');
};
