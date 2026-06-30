const singleSpaAngularWebpack = require('single-spa-angular/lib/webpack').default;

module.exports = (config, options) => {
  const singleSpaWebpackConfig = singleSpaAngularWebpack(config, options);

  // `zone.js` se mantiene como external: lo provee el shell (root-config) una
  // sola vez para todos los MFEs. En standalone se carga vía <script> en index.html.
  // Feel free to modify this webpack config however you'd like to
  return singleSpaWebpackConfig;
};
