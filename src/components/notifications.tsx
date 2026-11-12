"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { BadgeCheck, Bell, ClipboardList, PackageCheck, type LucideIcon } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { Dialog } from "@/components/dialog";
import { notify } from "@/lib/notify";
import { onOperation } from "@/lib/offline/sync";
import { supabaseBrowser } from "@/lib/supabase/client";

type Pending = { key: string; label: string; detail: string; href: string; icon: LucideIcon; ids: string[] };

// Lo pendiente se comparte entre la campana y el vigilante
let current: Pending[] = [];
const listeners = new Set<() => void>();
const store = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => void listeners.delete(l);
  },
  get: () => current,
  server: (): Pending[] => [],
};
function publish(next: Pending[]) {
  current = next;
  listeners.forEach((l) => l());
}

const EVERY = 60_000;

/**
 * Vigila lo que espera al usuario en el ERP (transferencias que llegan,
 * órdenes de compra por recibir, solicitudes por aprobar) y avisa con sonido
 * y notificación cuando aparece algo nuevo. También avisa el resultado de las
 * operaciones enviadas desde la cola.
 */
export function NotificationWatcher() {
  const { branch, can } = useApp();
  const receives = can("inventario", "edit");
  const approves = can("compras", "edit");
  const receivesPo = can("compras", "view") && receives;

  useEffect(
    () =>
      onOperation((op) => {
        if ("failed" in op) void notify({ title: "El ERP rechazó una operación", body: `${op.summary}: ${op.error ?? ""}`, href: "/sincronizacion", tag: `op-${op.id}`, tone: "error" });
        // Las lecturas de inventario son muchas: se confirman en su pantalla, sin aviso por cada una
        else if (op.kind !== "conteo") void notify({ title: "Aplicado en el ERP", body: op.summary, tag: `op-${op.id}`, tone: "success" });
      }),
    [],
  );

  useEffect(() => {
    const seenKey = `rls-seen:${branch.id}`;
    let seen: Record<string, string[]> | null = null;
    try {
      seen = JSON.parse(localStorage.getItem(seenKey) ?? "null");
    } catch {
      seen = null;
    }
    let alive = true;

    async function check() {
      if (!navigator.onLine) return;
      const supabase = supabaseBrowser();
      const [tr, po, rq] = await Promise.all([
        receives ? supabase.from("transfer_orders").select("id, number").eq("to_branch", branch.id).eq("status", "en_transito").limit(50) : null,
        receivesPo ? supabase.from("purchases").select("id, number").eq("branch_id", branch.id).eq("status", "ordenada").limit(50) : null,
        approves ? supabase.from("purchase_requisitions").select("id, number").eq("branch_id", branch.id).eq("status", "pendiente").limit(50) : null,
      ]);
      if (!alive) return;
      const ids = (r: { data: { id: string; number: string }[] | null } | null) => r?.data ?? [];
      const list: Pending[] = [];
      const add = (key: string, rows: { id: string; number: string }[], one: string, many: string, detail: string, href: string, icon: LucideIcon) => {
        if (rows.length) list.push({ key, label: `${rows.length} ${rows.length === 1 ? one : many}`, detail, href, icon, ids: rows.map((r) => r.id) });
      };
      add("tr", ids(tr), "transferencia por recibir", "transferencias por recibir", "En tránsito hacia esta tienda", "/transferencias/recibir", PackageCheck);
      add("po", ids(po), "orden de compra por recibir", "órdenes de compra por recibir", "Mercadería que debe llegar", "/recibos", ClipboardList);
      add("rq", ids(rq), "solicitud por aprobar", "solicitudes por aprobar", "Solicitudes de pedido pendientes", "/autorizaciones", BadgeCheck);
      publish(list);

      // Avisa solo lo nuevo (la primera vez, un resumen de lo pendiente)
      const fresh = list.filter((p) => p.ids.some((id) => !(seen?.[p.key] ?? []).includes(id)));
      if (fresh.length) {
        const first = seen === null;
        for (const p of fresh) {
          const nuevos = p.ids.filter((id) => !(seen?.[p.key] ?? []).includes(id)).length;
          void notify({ title: first ? p.label : `${nuevos} ${nuevos === 1 ? "nueva" : "nuevas"}: ${p.detail.toLowerCase()}`, body: first ? p.detail : p.label, href: p.href, tag: p.key });
        }
      }
      seen = Object.fromEntries(list.map((p) => [p.key, p.ids]));
      try {
        localStorage.setItem(seenKey, JSON.stringify(seen));
      } catch {
        // Sin almacenamiento: se avisará de nuevo al volver a abrir
      }
    }

    void check().catch(() => undefined);
    const timer = setInterval(() => void check().catch(() => undefined), EVERY);
    const onVisible = () => document.visibilityState === "visible" && void check().catch(() => undefined);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, [branch.id, receives, receivesPo, approves]);

  return null;
}

/** Campana de la barra superior con lo pendiente. */
export function NotificationBell() {
  const pending = useSyncExternalStore(store.subscribe, store.get, store.server);
  const [open, setOpen] = useState(false);
  const total = pending.reduce((s, p) => s + p.ids.length, 0);

  return (
    <>
      <button type="button" aria-label={`Notificaciones: ${total}`} onClick={() => setOpen(true)} className="relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full active:bg-white/10">
        <Bell className="h-5 w-5" />
        {total > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold">{total > 99 ? "99+" : total}</span>}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Notificaciones" size="sm">
        {pending.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500">No tienes nada pendiente.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {pending.map((p) => (
              <li key={p.key}>
                <Link href={p.href} onClick={() => setOpen(false)} className="flex items-center gap-3 py-3">
                  <p.icon className="h-6 w-6 shrink-0 text-sky-600" />
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">{p.label}</span>
                    <span className="block text-xs text-slate-500">{p.detail}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Dialog>
    </>
  );
}
