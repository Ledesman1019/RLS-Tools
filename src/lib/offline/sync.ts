"use client";

import { supabaseBrowser } from "@/lib/supabase/client";
import { kvGet, kvSet, queueAll, queueDelete, queuePut } from "./store";
import { backoffMs, classify, pendingInOrder, summarize, type QueuedOp } from "./sync-logic";

export type DoneOp = { id: string; kind: string; summary: string; at: number; result: Record<string, unknown> };
export type SyncState = { online: boolean; syncing: boolean; pending: number; errors: number; lastSync: number | null; lastError: string | null };

let state: SyncState = { online: true, syncing: false, pending: 0, errors: 0, lastSync: null, lastError: null };
const listeners = new Set<() => void>();
const opListeners = new Set<(op: DoneOp | (QueuedOp & { failed: true })) => void>();
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let started = false;

function set(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export const syncStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  get: () => state,
  server: (): SyncState => ({ online: true, syncing: false, pending: 0, errors: 0, lastSync: null, lastError: null }),
};

/** Avisa cuando una operación se aplica o el ERP la rechaza (para actualizar la pantalla). */
export function onOperation(listener: (op: DoneOp | (QueuedOp & { failed: true })) => void) {
  opListeners.add(listener);
  return () => {
    opListeners.delete(listener);
  };
}

async function refreshCounts() {
  const ops = await queueAll<QueuedOp>();
  set(summarize(ops));
  return ops;
}

/**
 * Pone una operación en la cola y la intenta enviar ya. Si no hay señal, queda
 * guardada en el celular y se envía sola al volver la conexión.
 */
export async function enqueue(input: { rpc: string; args: Record<string, unknown>; kind: string; summary: string; branchId: string }) {
  const op: QueuedOp = { ...input, id: crypto.randomUUID(), createdAt: Date.now(), attempts: 0, status: "pendiente" };
  await queuePut(op);
  await refreshCounts();
  void syncNow();
  return op.id;
}

/** Envía la cola en orden. Se detiene al perder la señal y reintenta con espera creciente. */
export async function syncNow(): Promise<void> {
  if (state.syncing) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    set({ online: false });
    return;
  }
  set({ syncing: true, online: true });
  try {
    const supabase = supabaseBrowser();
    for (const op of pendingInOrder(await queueAll<QueuedOp>())) {
      const { data, error } = await supabase.rpc(op.rpc, { ...op.args, p_op: op.id });
      const outcome = classify(error, navigator.onLine);
      if (outcome.kind === "offline") {
        const attempts = op.attempts + 1;
        await queuePut({ ...op, attempts });
        set({ online: navigator.onLine, lastError: error?.message ?? null });
        scheduleRetry(attempts);
        return;
      }
      if (outcome.kind === "rejected") {
        const failed = { ...op, status: "error" as const, error: outcome.message, attempts: op.attempts + 1 };
        await queuePut(failed);
        opListeners.forEach((l) => l({ ...failed, failed: true }));
        continue;
      }
      await queueDelete(op.id);
      const done: DoneOp = { id: op.id, kind: op.kind, summary: op.summary, at: Date.now(), result: (data ?? {}) as Record<string, unknown> };
      const history = ((await kvGet<DoneOp[]>("history")) ?? []).slice(0, 199);
      await kvSet("history", [done, ...history]);
      opListeners.forEach((l) => l(done));
    }
    set({ lastSync: Date.now(), lastError: null });
  } finally {
    set({ syncing: false });
    await refreshCounts();
  }
}

function scheduleRetry(attempt: number) {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = setTimeout(() => void syncNow(), backoffMs(attempt));
}

/** Reintentar una operación que el ERP rechazó (por ejemplo, tras corregir el dato en el ERP). */
export async function retryOp(op: QueuedOp) {
  await queuePut({ ...op, status: "pendiente", error: undefined });
  await refreshCounts();
  void syncNow();
}

export async function discardOp(id: string) {
  await queueDelete(id);
  await refreshCounts();
}

export const pendingOps = () => queueAll<QueuedOp>();
export const history = async () => (await kvGet<DoneOp[]>("history")) ?? [];

/** Arranca la sincronización automática (al volver la señal y cada 30 s). */
export function startSync() {
  if (started || typeof window === "undefined") return;
  started = true;
  set({ online: navigator.onLine });
  window.addEventListener("online", () => {
    set({ online: true });
    void syncNow();
  });
  window.addEventListener("offline", () => set({ online: false }));
  setInterval(() => void syncNow(), 30_000);
  void refreshCounts().then(() => syncNow());
}
