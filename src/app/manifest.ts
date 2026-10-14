import type { MetadataRoute } from "next";

// App instalável (PWA): "Adicionar à tela inicial" no iPhone/Android, sem loja e sem custo
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BIO CELL – Prontuário e Estoque",
    short_name: "BIO CELL",
    description: "Prontuário de células-tronco, pacientes e estoque",
    start_url: "/pacientes",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5f7f5",
    theme_color: "#005847",
    lang: "pt-BR",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
