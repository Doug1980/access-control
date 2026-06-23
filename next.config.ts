import type { NextConfig } from "next";

const securityHeaders = [
  // Impede que a página seja embutida em iframes (proteção contra clickjacking).
  { key: "X-Frame-Options", value: "DENY" },

  // Impede que o browser faça MIME-sniffing do Content-Type.
  { key: "X-Content-Type-Options", value: "nosniff" },

  // Controla quais informações de referrer são enviadas nas requisições.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },

  // Desativa features de hardware que o app não usa.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },

  // Força HTTPS por 1 ano (ativar apenas em produção com HTTPS garantido).
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },

  // Content Security Policy — restringe de onde scripts, estilos e conexões podem vir.
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Scripts: próprio domínio + 'unsafe-inline' exigido pelo Next.js (inline scripts de hidratação)
      // + apis.google.com, exigido pelo fluxo de signInWithPopup do Firebase Auth (carrega api.js).
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com",
      // Estilos: próprio domínio + inline (Tailwind/CSS-in-JS).
      "style-src 'self' 'unsafe-inline'",
      // Imagens: próprio domínio + data URIs (favicons, avatars base64).
      "img-src 'self' data: https:",
      // Fontes: próprio domínio.
      "font-src 'self'",
      // Conexões de rede: API própria + Firebase Auth + Pusher (WebSocket e HTTP).
      [
        "connect-src 'self'",
        "https://*.firebaseapp.com",
        "https://*.googleapis.com",
        "https://identitytoolkit.googleapis.com",
        "https://securetoken.googleapis.com",
        "https://soketi.pusher.com",
        "https://api-us2.pusher.com",
        "wss://*.pusher.com",
      ].join(" "),
      // Frames: apenas os necessários ao popup de auth do Firebase (iframe de relay no authDomain
      // + telas de consentimento do Google). Sem isso, signInWithPopup falha antes de abrir o popup.
      "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com https://apis.google.com",
      // Objetos (Flash, etc.): nenhum.
      "object-src 'none'",
      // Força HTTPS para todos os recursos carregados.
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Aplica em todas as rotas.
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },

  // Silencia o aviso do Next.js 16 sobre webpack config sem turbopack config.
  turbopack: {},

  webpack: (config) => {
    // Garante que o Webpack resolva os módulos ESM (jose) corretamente
    // em vez de deixar o Node fazer require() deles.
    config.externals = config.externals || [];
    return config;
  },
};

export default nextConfig;
