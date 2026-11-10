import type { MetadataRoute } from "next";

// Nome e cores do atalho "Adicionar à tela inicial".
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Contas do Casal",
    short_name: "Contas",
    description: "Compras, parcelas e acertos do casal",
    start_url: "/",
    display: "standalone",
    background_color: "#f2f4f8",
    theme_color: "#2563eb",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
