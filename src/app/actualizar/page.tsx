import type { Metadata } from "next";
import { DatabaseZap } from "lucide-react";
import { hasSupabaseEnv } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Falta actualizar el ERP" };

/** RLS Tools necesita la migración 0010 del ERP HANA4 (ubicaciones, conteos y bitácora). */
export default function UpdatePage() {
  return (
    <div className="desk-bg flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-md rounded-[4px] border border-white/70 bg-[#f3f5f8] p-5 text-slate-800 shadow-2xl">
        <DatabaseZap className="h-10 w-10 text-brand-600" />
        <h1 className="mt-3 text-lg font-bold">{hasSupabaseEnv ? "Falta actualizar la base del ERP" : "Falta configurar la conexión"}</h1>
        {hasSupabaseEnv ? (
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            RLS Tools usa la misma base de datos del ERP HANA4 y necesita la migración <code className="rounded bg-slate-200 px-1">0010_rls_tools.sql</code> (ubicaciones,
            inventarios y bitácora móvil). Ejecútala en Supabase → SQL Editor y vuelve a abrir la app.
          </p>
        ) : (
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Configura <code className="rounded bg-slate-200 px-1">NEXT_PUBLIC_SUPABASE_URL</code> y <code className="rounded bg-slate-200 px-1">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> con los
            mismos valores del ERP HANA4.
          </p>
        )}
      </div>
    </div>
  );
}
