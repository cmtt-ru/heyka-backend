const path = require('path');
const webpackPlugins = [];

module.exports = {
  configureWebpack: {
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src/'),
      },
    },
    plugins: webpackPlugins,
    devtool: 'source-map',
  },

  pluginOptions: {
    i18n: {
      locale: 'en',
      fallbackLocale: 'en',
      localeDir: 'translations',
      enableInSFC: true,
    },
    svgSprite: {
      dir: 'src/assets/icons',
      test: /\.svg$/,
      loaderOptions: {
        extract: true,
        spriteFilename: 'img/icons.svg',
      },
    },
    prerenderSpa: {
      registry: undefined,
      renderRoutes: [
        '/',
      ],
      useRenderEvent: true,
      headless: true,
      onlyProduction: true,
    },
  },

  chainWebpack: config => {
    config.module
      .rule('svg-sprite')
      .use('svgo-loader')
      .loader('svgo-loader');
  },
};
