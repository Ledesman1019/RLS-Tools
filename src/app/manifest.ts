import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RLS Tools · ERP HANA4",
    short_name: "RLS Tools",
    description: "Almacén en el celular: escaneo, inventario físico, consulta y movimientos sincronizados con el ERP HANA4.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "es",
    background_color: "#1f74cf",
    theme_color: "#1c2a5e",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Escanear", url: "/escaneo", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Consulta rápida", url: "/consulta", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Sincronización", url: "/sincronizacion", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
