const singleSpaAngularWebpack = require('single-spa-angular/lib/webpack').default;

module.exports = (config, options) => {
  const singleSpaWebpackConfig = singleSpaAngularWebpack(config, options);


  singleSpaWebpackConfig.ignoreWarnings = [
    ...(singleSpaWebpackConfig.ignoreWarnings ?? []),
    /style-loader[\\/]dist[\\/]runtime[\\/].*\.js/,
  ];

  return singleSpaWebpackConfig;
};
