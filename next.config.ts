import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // firebase-admin e suas dependências ESM (jose, jwks-rsa) precisam ficar
  // FORA do bundle serverless. Empacotá-las faz o Turbopack carregar via
  // require() um módulo ESM → ERR_REQUIRE_ESM. Externalizadas, rodam em Node nativo.
  serverExternalPackages: [
    "firebase-admin",
    "jose",
    "jwks-rsa",
    "google-auth-library",
    "gcp-metadata",
  ],
};

export default nextConfig;