import type { Metadata } from "next";
import { ArrowLeftRight, ClipboardCheck, RefreshCw, ScanBarcode, Search, FileBarChart } from "lucide-react";
import { BrandMark } from "@/components/brand";
import { databaseLabel } from "@/lib/supabase/env";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Iniciar sesión" };

const FEATURES = [ScanBarcode, ClipboardCheck, Search, ArrowLeftRight, FileBarChart, RefreshCw];

export default function LoginPage() {
  return (
    <div className="desk-bg relative flex min-h-dvh flex-col overflow-hidden px-4 pb-8 pt-[max(1.5rem,env(safe-area-inset-top))] text-white">
      <div className="flex items-center gap-3">
        <BrandMark className="h-12 w-12 rounded-2xl p-1" />
        <div className="leading-tight">
          <p className="text-2xl font-black tracking-tight">RLS Tools</p>
          <p className="text-xs font-semibold text-white/80">Almacén móvil · ERP HANA4</p>
        </div>
      </div>

      <section aria-labelledby="login-title" className="mt-6 rounded-[4px] border border-white/70 bg-[#f3f5f8] text-slate-900 shadow-[0_18px_50px_-12px_rgb(0_0_0/0.55)]">
        <h1 id="login-title" className="border-b border-slate-300 bg-gradient-to-b from-white to-slate-100 px-3 py-2.5 text-center text-sm font-semibold text-slate-800">
          Información de Usuario
        </h1>
        <div className="p-4">
          <LoginForm database={databaseLabel()} />
        </div>
      </section>

      <div aria-hidden className="mt-8 grid grid-cols-6 gap-2 opacity-90">
        {FEATURES.map((Icon, i) => (
          <span key={i} className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-white/40 bg-white/10">
            <Icon className="h-5 w-5" />
          </span>
        ))}
      </div>
      <p className="mt-auto pt-8 text-center text-xs text-white/70">Usa tu misma cuenta del ERP HANA4. Conexión segura.</p>
    </div>
  );
}
