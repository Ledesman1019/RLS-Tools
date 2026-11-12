import type { Metadata } from "next";
import Link from "next/link";
import { LogIn } from "lucide-react";
import { BrandLogo } from "@/components/brand";

export const metadata: Metadata = { title: "Sesión cerrada" };

/** Pantalla de salida para cuando el sistema no permite cerrar la app sola (Android, pestaña del navegador). */
export default function GoodbyePage() {
  return (
    <div className="desk-bg flex min-h-dvh items-center justify-center p-6 text-center text-white">
      <div className="w-full max-w-xs">
        <BrandLogo className="mx-auto w-56" />
        <p className="mt-6 text-lg font-bold">Saliste de RLS Tools</p>
        <p className="mt-1 text-sm text-white/80">Ya puedes cerrar la aplicación.</p>
        <Link href="/login" className="mt-8 inline-flex h-11 items-center gap-2 rounded-md border border-white/70 bg-white/10 px-5 text-sm font-semibold">
          <LogIn className="h-4 w-4" /> Volver a entrar
        </Link>
      </div>
    </div>
  );
}
