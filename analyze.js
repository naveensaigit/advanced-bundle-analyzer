process.env.NODE_ENV = "production";

const webpack = require("webpack");

const BundleAnalyzerPlugin =
  require("webpack-bundle-analyzer").BundleAnalyzerPlugin;

const webpackConfigProd = require("react-scripts/config/webpack.config")(
  "production"
);

webpackConfigProd.plugins.push(
  new BundleAnalyzerPlugin({ 
    'generateStatsFile': true,
    'analyzerMode': "static",
  })
);

webpack(webpackConfigProd, (err, stats) => {
  // console.log("ok", stats);
  if (err || stats.hasErrors()) {
    console.log(err);
  }
});
