import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    // Garante que o Webpack resolva os módulos ESM (jose) corretamente
    // em vez de deixar o Node fazer require() deles.
    config.externals = config.externals || [];
    return config;
  },
};

export default nextConfig;