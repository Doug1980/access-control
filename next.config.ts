import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // firebase-admin (e suas deps jose/jwks-rsa) são ESM Node-only.
  // Mantê-lo fora do bundle evita o erro ERR_REQUIRE_ESM no serverless da Vercel.
  serverExternalPackages: ["firebase-admin"],
};

export default nextConfig;