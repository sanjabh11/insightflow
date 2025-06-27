// next.config.js for custom webpack rules and suppressing dynamic require warnings
/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // Suppress require.extensions warning
    config.module.rules.push({
      test: /\.m?js$/,
      resolve: { fullySpecified: false },
    });
    return config;
  },
};

module.exports = nextConfig;
