"use client";

import { useSyncExternalStore, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Cloud, CloudOff, Lock, LogOut, RefreshCw, Settings, UserRound } from "lucide-react";
import { logout } from "@/app/actions";
import { useApp } from "@/components/app-provider";
import { BrandMark } from "@/components/brand";
import { NotificationBell, NotificationWatcher } from "@/components/notifications";
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
          // Marca de agua, igual que el escritorio del ERP
          <div aria-hidden className="pointer-events-none absolute bottom-5 right-6 flex items-center gap-3 opacity-95 sm:bottom-8 sm:right-10">
            <BrandMark className="h-12 w-12 rounded-2xl p-1 sm:h-16 sm:w-16" />
            <div className="leading-none text-white">
              <p className="text-3xl font-extrabold tracking-tight sm:text-5xl">
                rls<span className="text-sky-300">tools</span>
              </p>
              <p className="mt-1 text-xs font-semibold tracking-wide text-white/80 sm:text-sm">almacén móvil · hana4</p>
            </div>
          </div>
        )}
        <div className={cn("relative px-3 pt-3", isMenu ? "pb-32 sm:px-8" : "mx-auto w-full max-w-[40rem] pb-6 sm:pt-5")}>
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
  const [pending, start] = useTransition();

  // Cerrar sesión: vuelve al login. Salir de la aplicación solo se ofrece en el login.
  function signOutHere() {
    if (sync.pending > 0 && !confirm(`Tienes ${sync.pending} operaciones sin enviar al ERP. Si cierras sesión se perderán. ¿Cerrar sesión de todas formas?`)) return;
    start(async () => {
      // Seguridad: no queda nada de la empresa guardado en el celular
      await clearAll().catch(() => {});
      navigator.serviceWorker?.controller?.postMessage("clear");
      await logout();
    });
  }

  return (
    <footer className="sticky bottom-0 z-30 grid grid-cols-2 bg-taskbar pb-[env(safe-area-inset-bottom)] text-white shadow-[0_-2px_10px_rgb(0_0_0/0.25)] sm:flex sm:justify-center sm:gap-4">
      <Link href="/configuracion" className="flex h-16 flex-col items-center justify-center gap-0.5 active:bg-white/10 sm:w-44 sm:rounded-md sm:hover:bg-white/10">
        <Settings className="h-6 w-6 text-sky-300" />
        <span className="text-sm">Configuración</span>
      </Link>
      <button type="button" disabled={pending} onClick={signOutHere} className="flex h-16 cursor-pointer flex-col items-center justify-center gap-0.5 active:bg-white/10 disabled:opacity-60 sm:w-44 sm:rounded-md sm:hover:bg-white/10">
        {pending ? <RefreshCw className="h-6 w-6 animate-spin text-rose-300" /> : <LogOut className="h-6 w-6 text-rose-300" />}
        <span className="text-sm">{pending ? "Cerrando…" : "Cerrar Sesión"}</span>
      </button>
    </footer>
  );
}
