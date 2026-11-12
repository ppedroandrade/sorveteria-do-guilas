import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // Imagens de produto/logotipo são redimensionadas no navegador antes do envio.
      bodySizeLimit: "2mb",
    },
  },
  async headers() {
    // ALLOW_HF_IFRAME=1 (definido no build do Docker) permite exibir o app dentro da
    // página do Hugging Face Spaces; caso contrário, nenhum site pode embutir o sistema.
    const frame = process.env.ALLOW_HF_IFRAME === "1"
      ? [{ key: "Content-Security-Policy", value: "frame-ancestors 'self' https://huggingface.co https://*.huggingface.co" }]
      : [{ key: "X-Frame-Options", value: "DENY" }, { key: "Content-Security-Policy", value: "frame-ancestors 'none'" }];
    return [
      {
        source: "/(.*)",
        headers: [
          ...frame,
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
