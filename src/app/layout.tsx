import type { Metadata, Viewport } from "next";
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { PwaSetup } from "@/components/pwa";
import { ThemedToaster } from "@/components/theme";
import { THEME_SCRIPT } from "@/lib/theme-script";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "RLS Tools", template: "%s · RLS Tools" },
  description: "Almacén móvil del ERP HANA4: escaneo, inventario físico, consulta rápida y movimientos.",
  robots: { index: false, follow: false },
  applicationName: "RLS Tools",
  appleWebApp: { capable: true, title: "RLS Tools", statusBarStyle: "black-translucent" },
  icons: { apple: "/icons/apple-touch-icon.png" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1c2a5e",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${jakarta.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full">
        {children}
        <ThemedToaster />
        <PwaSetup />
      </body>
    </html>
  );
}
