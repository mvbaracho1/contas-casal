import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Upload da fatura (PDF/OFX/CSV) para importação: até 4 MB (a Vercel aceita até 4,5 MB).
    serverActions: { bodySizeLimit: "5mb" },
  },
  // pdf.js tem arquivos que o bundler não deve mexer
  serverExternalPackages: ["unpdf"],
};

export default nextConfig;
