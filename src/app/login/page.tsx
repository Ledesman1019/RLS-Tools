import type { Metadata } from "next";
import { BrandLogo } from "@/components/brand";
import { CENTRAL_NAME } from "@/lib/supabase/env";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Iniciar sesión" };

/** Inicio de sesión pequeño y centrado, como una app nativa (también en la computadora). */
export default function LoginPage() {
  return (
    <div className="desk-bg flex min-h-dvh flex-col items-center justify-center px-5 py-[max(1.5rem,env(safe-area-inset-top))] text-white">
      <div className="w-full max-w-[340px]">
        <BrandLogo className="mx-auto w-full max-w-[280px] drop-shadow-[0_8px_24px_rgb(0_0_0/0.35)]" />
        <p className="mt-1 text-center text-xs font-semibold tracking-wide text-white/80">Almacén móvil · ERP HANA4</p>

        <section aria-labelledby="login-title" className="mt-5 rounded-[4px] border border-white/70 bg-[#f3f5f8] text-slate-900 shadow-[0_18px_50px_-12px_rgb(0_0_0/0.55)]">
          <h1 id="login-title" className="border-b border-slate-300 bg-gradient-to-b from-white to-slate-100 px-3 py-2 text-center text-[13px] font-semibold text-slate-800">
            Información de Usuario
          </h1>
          <div className="p-4">
            <LoginForm central={CENTRAL_NAME} />
          </div>
        </section>
        <p className="mt-5 text-center text-[11px] text-white/70">Usa tu misma cuenta del ERP HANA4 · Conexión segura</p>
      </div>
    </div>
  );
}
