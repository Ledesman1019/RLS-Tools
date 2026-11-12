import type { Metadata } from "next";
import { Suspense } from "react";
import { Lock } from "lucide-react";
import { logout } from "@/app/actions";

export const metadata: Metadata = { title: "Sin acceso" };

export default function NoAccessPage({ searchParams }: PageProps<"/sin-acceso">) {
  return (
    <div className="desk-bg flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-md rounded-[4px] border border-white/70 bg-[#f3f5f8] p-5 text-slate-800 shadow-2xl">
        <Lock className="h-10 w-10 text-slate-500" />
        <Suspense fallback={<h1 className="mt-3 text-lg font-bold">Sin acceso</h1>}>
          <Reason searchParams={searchParams} />
        </Suspense>
        <form action={logout} className="mt-5">
          <button type="submit" className="h-11 w-full cursor-pointer rounded-md bg-brand-600 text-sm font-semibold text-white">
            Entrar con otra cuenta
          </button>
        </form>
      </div>
    </div>
  );
}

async function Reason({ searchParams }: Pick<PageProps<"/sin-acceso">, "searchParams">) {
  const inactive = (await searchParams).motivo === "inactive";
  return (
    <>
      <h1 className="mt-3 text-lg font-bold">{inactive ? "Tu cuenta no tiene acceso" : "Tu rol no usa RLS Tools"}</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        {inactive
          ? "Tu cuenta está desactivada o pendiente de activación en el ERP HANA4. Pide al administrador que la active."
          : "RLS Tools es la herramienta del almacén: requiere permiso de Inventario en el ERP HANA4 (por ejemplo, el rol Almacenero). Pide el permiso al administrador."}
      </p>
    </>
  );
}
