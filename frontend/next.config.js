/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Required for @cofhe/sdk WASM module
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    config.module.rules.push({
      test: /tfhe_bg\.wasm$/,
      type: "asset/resource",
    });
    config.module.rules.push({
      test: /\.wasm$/,
      exclude: /tfhe_bg\.wasm$/,
      type: "webassembly/async",
    });
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }
    return config;
  },
};
module.exports = nextConfig;
