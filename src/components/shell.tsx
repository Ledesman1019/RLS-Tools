"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Cloud, CloudOff, Lock, LogOut, Power, RefreshCw, Settings, UserRound } from "lucide-react";
import { logout, signOut } from "@/app/actions";
import { useApp } from "@/components/app-provider";
import { BrandMark } from "@/components/brand";
import { Dialog } from "@/components/dialog";
import { NotificationBell, NotificationWatcher } from "@/components/notifications";
import { Button } from "@/components/ui";
import { exitApp } from "@/lib/exit";
import { canUse, locate } from "@/lib/menu";
import { useSync } from "@/lib/offline/hooks";
import { clearAll } from "@/lib/offline/store";
import { terminalId } from "@/lib/terminal";
import { cn } from "@/lib/utils";

/**
 * Marco móvil al estilo de las terminales de almacén: barra superior con
 * «Atrás», título, sincronización y usuario; barra inferior con Configuración
 * y Cerrar sesión.
 */
export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { profile, permissions } = useApp();
  const place = locate(pathname);
  const isMenu = pathname === "/" || pathname.startsWith("/menu/");
  // «Atrás»: de una herramienta a su sección; de una sección al inicio; de un detalle a su lista
  const back =
    pathname === "/"
      ? null
      : !place || pathname.startsWith("/menu/") || pathname === "/configuracion"
        ? "/"
        : place.tool && pathname !== place.tool.href
          ? place.tool.href
          : `/menu/${place.section.key}`;
  const title = pathname === "/configuracion" ? "Configuración" : place?.tool ? place.tool.label : place?.section.label;
  const allowed = !place?.tool || canUse(place.tool, profile.role, permissions);

  return (
    <div className="flex min-h-dvh flex-col bg-taskbar">
      <NotificationWatcher />
      <TopBar back={back} title={title} />
      <main className={cn("relative flex-1 overflow-hidden", isMenu ? "desk-bg" : "bg-app")}>
        {isMenu && (
          // Marca de agua del engranaje, como en las terminales de almacén
          <Settings aria-hidden className="pointer-events-none absolute -bottom-10 -right-12 h-72 w-72 text-sky-300/25" strokeWidth={1.4} />
        )}
        <div className="relative px-3 pb-6 pt-3">
          {allowed ? (
            children
          ) : (
            <div className="mt-10 flex flex-col items-center text-center">
              <Lock className="h-10 w-10 text-slate-400" />
              <p className="mt-3 font-semibold text-slate-900">Tu rol no tiene esta herramienta</p>
              <p className="mt-1 text-sm text-slate-500">Pide el permiso correspondiente al administrador del ERP HANA4.</p>
            </div>
          )}
        </div>
      </main>
      <BottomBar />
    </div>
  );
}

function TopBar({ back, title }: { back: string | null; title?: string }) {
  const { profile } = useApp();
  const sync = useSync();
  const terminal = useSyncExternalStore(
    () => () => {},
    () => terminalId(),
    () => "",
  );
  const code = profile.email.split("@")[0].toUpperCase().slice(0, 12);

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 bg-taskbar px-2 pt-[env(safe-area-inset-top)] text-white shadow-md">
      {back ? (
        <Link href={back} aria-label="Atrás" className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-md pr-2 active:bg-white/10">
          <ArrowLeft className="h-6 w-6 shrink-0" />
          <span className="truncate text-[15px] font-bold">{title ?? "Atrás"}</span>
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-2 pl-1">
          <BrandMark className="h-9 w-9 rounded-lg" />
          <span className="truncate text-[15px] font-black tracking-tight">
            RLS<span className="text-sky-300">Tools</span>
          </span>
        </div>
      )}
      <Link
        href="/sincronizacion"
        aria-label={!sync.online ? "Sin señal" : `${sync.pending} operaciones por enviar`}
        className={cn(
          "flex h-8 shrink-0 items-center gap-1 rounded-full px-2.5 text-[11px] font-bold",
          !sync.online ? "bg-amber-500" : sync.errors ? "bg-red-500" : sync.pending ? "bg-white text-taskbar" : "bg-white/10 text-white/80",
        )}
      >
        {!sync.online ? <CloudOff className="h-3.5 w-3.5" /> : sync.syncing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Cloud className="h-3.5 w-3.5" />}
        {!sync.online ? "Offline" : sync.errors ? sync.errors : sync.pending || ""}
      </Link>
      <NotificationBell />
      <div className="flex shrink-0 items-center gap-1.5 pl-1 text-right leading-tight">
        <span className="text-[10px] font-bold">
          {code}
          <span className="block text-white/60">{terminal}</span>
        </span>
        <UserRound className="h-6 w-6 text-sky-300" />
      </div>
    </header>
  );
}

function BottomBar() {
  const sync = useSync();
  const [open, setOpen] = useState(false);

  async function forget() {
    // Seguridad: no queda nada de la empresa guardado en el celular
    await clearAll().catch(() => {});
    navigator.serviceWorker?.controller?.postMessage("clear");
  }
  const confirmLoss = () => sync.pending === 0 || confirm("Hay operaciones sin enviar al ERP. ¿Salir de todas formas y descartarlas?");

  return (
    <footer className="sticky bottom-0 z-30 grid grid-cols-2 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] text-slate-700 shadow-[0_-2px_10px_rgb(0_0_0/0.15)]">
      <Link href="/configuracion" className="flex h-16 flex-col items-center justify-center gap-0.5 active:bg-slate-100">
        <Settings className="h-6 w-6 text-sky-600" />
        <span className="text-sm">Configuración</span>
      </Link>
      <button type="button" onClick={() => setOpen(true)} className="flex h-16 cursor-pointer flex-col items-center justify-center gap-0.5 active:bg-slate-100">
        <LogOut className="h-6 w-6 text-rose-600" />
        <span className="text-sm">Cerrar Sesión</span>
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} title="Cerrar sesión" size="sm">
        {sync.pending > 0 && (
          <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Tienes {sync.pending} operaciones sin enviar al ERP. Si sales ahora se perderán: sincroniza primero.
          </p>
        )}
        <div className="grid gap-2">
          <form
            action={logout}
            onSubmit={async (e) => {
              if (!confirmLoss()) return e.preventDefault();
              await forget();
            }}
          >
            <Button type="submit" variant="secondary" className="h-12 w-full">
              <LogOut className="h-4 w-4" /> Cerrar sesión (cambiar de usuario)
            </Button>
          </form>
          <Button
            variant="danger"
            className="h-12 w-full"
            onClick={async () => {
              if (!confirmLoss()) return;
              await forget();
              await signOut();
              exitApp();
            }}
          >
            <Power className="h-4 w-4" /> Salir de la aplicación
          </Button>
          <Button variant="ghost" className="h-11 w-full" onClick={() => setOpen(false)}>
            Volver
          </Button>
        </div>
      </Dialog>
    </footer>
  );
}
