"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Building2, Cloud, CloudOff, Lock, LogOut, RefreshCw, UserRound } from "lucide-react";
import { logout, setBranch } from "@/app/actions";
import { useApp } from "@/components/app-provider";
import { Dialog, DialogFooter } from "@/components/dialog";
import { Button } from "@/components/ui";
import { toolFor } from "@/lib/menu";
import { useSync } from "@/lib/offline/hooks";
import { clearAll } from "@/lib/offline/store";
import { cn } from "@/lib/utils";

/** Marco móvil: pantalla, botón «Atrás» y barra inferior con perfil y sincronización. */
export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const home = pathname === "/";
  const tool = toolFor(pathname);
  // Dentro de una herramienta, «Atrás» sube un nivel (ej. de un inventario a la lista)
  const parent = tool && pathname !== tool.href ? tool.href : "/";
  const { can } = useApp();
  const allowed = !tool?.needs || can("inventario", tool.needs);

  return (
    <div className="flex min-h-dvh flex-col">
      {home ? (
        <div className="desk-bg flex-1">{children}</div>
      ) : (
        <main className="flex-1 bg-app pb-4">
          <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-surface/95 px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur">
            <Link href={parent} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md border border-slate-300 bg-surface pl-2.5 pr-3.5 text-sm font-semibold text-slate-700 active:bg-slate-100">
              <ArrowLeft className="h-4 w-4" />
              Atrás
            </Link>
            {tool && (
              <p className="min-w-0 truncate text-sm font-bold text-slate-900">
                <span className="mr-1.5 font-mono text-xs text-link">{tool.code}</span>
                {tool.label}
              </p>
            )}
          </div>
          <div className="px-3 pt-3">
            {allowed ? (
              children
            ) : (
              <div className="mt-10 flex flex-col items-center text-center">
                <Lock className="h-10 w-10 text-slate-400" />
                <p className="mt-3 font-semibold text-slate-900">Tu rol no tiene esta herramienta</p>
                <p className="mt-1 text-sm text-slate-500">Pide el permiso de Inventario correspondiente al administrador del ERP.</p>
              </div>
            )}
          </div>
        </main>
      )}
      <BottomBar />
    </div>
  );
}

function BottomBar() {
  const { profile, roleName, branch, branches, can } = useApp();
  const sync = useSync();
  const [open, setOpen] = useState(false);
  const [switching, startSwitch] = useTransition();
  const canSwitch = (can("reportes", "view") || can("configuracion", "view")) && branches.length > 1;
  const initials = profile.full_name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <footer className="sticky bottom-0 z-30 bg-taskbar pb-[env(safe-area-inset-bottom)] text-white shadow-[0_-2px_10px_rgb(0_0_0/0.25)]">
      <div className="flex h-14 items-center gap-2 px-2">
        <button type="button" onClick={() => setOpen(true)} className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-left active:bg-white/10" aria-label="Perfil">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-bold">{initials || <UserRound className="h-5 w-5" />}</span>
          <span className="min-w-0 text-[10px] font-semibold uppercase leading-[1.25] tracking-wide">
            <span className="block truncate">{profile.full_name}</span>
            <span className="block truncate text-white/60">
              {roleName} · {branch.name}
            </span>
          </span>
        </button>
        <Link
          href="/sincronizacion"
          className={cn(
            "flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-semibold",
            !sync.online ? "bg-amber-500 text-white" : sync.errors > 0 ? "bg-red-500 text-white" : sync.pending > 0 ? "bg-white/90 text-taskbar" : "bg-white/10 text-white/85",
          )}
          aria-label="Sincronización"
        >
          {!sync.online ? <CloudOff className="h-4 w-4" /> : sync.syncing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />}
          {!sync.online ? "Sin señal" : sync.errors > 0 ? `${sync.errors} error${sync.errors === 1 ? "" : "es"}` : sync.pending > 0 ? `${sync.pending} por enviar` : "Al día"}
        </Link>
      </div>

      <Dialog open={open} onClose={() => setOpen(false)} title={profile.full_name} description={`${roleName} · ${profile.email}`} size="sm">
        {canSwitch && (
          <label className="mb-4 block">
            <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-700">
              <Building2 className="h-4 w-4" /> Sucursal de trabajo
            </span>
            <select
              value={branch.id}
              disabled={switching}
              onChange={(e) => {
                const id = e.target.value;
                startSwitch(() => setBranch(id));
              }}
              className="h-11 w-full rounded-lg border border-slate-300 bg-surface px-3 text-sm"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {sync.pending > 0 && (
          <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Tienes {sync.pending} operaciones sin enviar. Si cierras sesión ahora se perderán: sincroniza primero.
          </p>
        )}
        <form
          action={logout}
          onSubmit={async (e) => {
            if (sync.pending > 0 && !confirm("Hay operaciones sin enviar al ERP. ¿Cerrar sesión de todas formas y descartarlas?")) {
              e.preventDefault();
              return;
            }
            // Seguridad: no queda nada de la empresa guardado en el celular
            await clearAll().catch(() => {});
            navigator.serviceWorker?.controller?.postMessage("clear");
          }}
        >
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Volver
            </Button>
            <Button type="submit" variant="danger">
              <LogOut className="h-4 w-4" /> Cerrar sesión
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </footer>
  );
}
