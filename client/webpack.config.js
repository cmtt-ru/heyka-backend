const path = require('path');

module.exports = {
  resolve: {
    alias: {
      '@components': require('path').resolve(__dirname, 'src/components')
    }
  }
};
