const path = require('path');
const webpackPlugins = [];

module.exports = {
  configureWebpack: {
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src/'),
        '@api': path.resolve(__dirname, 'src/api'),
        '@components': path.resolve(__dirname, 'src/components'),
        '@assets': path.resolve(__dirname, 'src/assets'),
        '@icons': path.resolve(__dirname, 'src/renderer/components/icons'),
        '@views': path.resolve(__dirname, 'src/renderer/views'),
        '@static': path.resolve(__dirname, 'public'),
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
