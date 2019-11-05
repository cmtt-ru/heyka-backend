'use strict';

const HauteCouture = require('haute-couture');

exports.plugin = {
  pkg: require('../package.json'),
  register: HauteCouture.using()
};
