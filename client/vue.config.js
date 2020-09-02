const path = require('path');
const webpackPlugins = [];
const fs = require('fs');

/**
 * SSL cert file paths
 * @type {{cert: string, key: string}}
 */
const ssl = {
  key: './certs/localhost.key',
  cert: './certs/localhost.crt',
};

/**
 * Webpack dev server options
 * @type {object}
 */
let devServer = {};

/**
 * If ssl cert files exist, enable local https
 */
if (fs.existsSync(ssl.key)) {
  devServer = {
    https: {
      key: fs.readFileSync(ssl.key),
      cert: fs.readFileSync(ssl.cert),
    },
    public: 'https://localhost:8080/',
  };
}

module.exports = {
  devServer,
  configureWebpack: {
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src/'),
        '@api': path.resolve(__dirname, 'src/api'),
        '@components': path.resolve(__dirname, 'src/components'),
        '@assets': path.resolve(__dirname, 'src/assets'),
        '@icons': path.resolve(__dirname, 'src/components/icons'),
        '@views': path.resolve(__dirname, 'src/views'),
        '@static': path.resolve(__dirname, 'public'),
        '@libs': path.resolve(__dirname, 'src/libs'),
        '@classes': path.resolve(__dirname, 'src/classes'),
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
