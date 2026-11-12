/**
 * Reglas de la cola de sincronización (funciones puras, probadas en tests/unit).
 *
 * Cada operación lleva un id generado en el celular. El ERP lo guarda en su
 * bitácora (mobile_operations): si la misma operación llega dos veces —porque
 * se cortó la señal justo después de enviarla— el ERP devuelve el resultado
 * anterior y no la aplica de nuevo.
 */
export type OpStatus = "pendiente" | "error";

export type QueuedOp = {
  id: string;
  /** Función del ERP que la aplica (rls_count, rls_move…) */
  rpc: string;
  args: Record<string, unknown>;
  kind: string;
  summary: string;
  branchId: string;
  createdAt: number;
  attempts: number;
  status: OpStatus;
  error?: string;
};

export type SyncOutcome = { kind: "ok" } | { kind: "offline" } | { kind: "rejected"; message: string };

/** Orden de envío: primero lo más antiguo; las operaciones con error esperan a que el usuario las revise. */
export function pendingInOrder(ops: QueuedOp[]): QueuedOp[] {
  return ops.filter((o) => o.status === "pendiente").sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
}

/**
 * Clasifica la respuesta del ERP:
 *  - sin red o servidor caído → se reintenta luego (la operación sigue pendiente)
 *  - el ERP la rechazó por una regla de negocio → queda con error para revisarla
 */
export function classify(error: { message?: string; code?: string; status?: number } | null | undefined, online: boolean): SyncOutcome {
  if (!error) return { kind: "ok" };
  const message = error.message ?? "";
  const network = !online || /failed to fetch|networkerror|network request failed|load failed|fetch failed|timeout|aborted/i.test(message) || error.status === 0 || (error.status ?? 0) >= 500;
  if (network) return { kind: "offline" };
  // Sesión vencida: no es culpa de la operación; se reintenta al volver a entrar
  if (error.status === 401 || /jwt|token/i.test(message)) return { kind: "offline" };
  return { kind: "rejected", message: message || "El ERP rechazó la operación" };
}

/** Espera antes de reintentar: 2 s, 4 s, 8 s… hasta 1 minuto. */
export function backoffMs(attempt: number) {
  return Math.min(60_000, 2_000 * 2 ** Math.max(0, attempt - 1));
}

/** Resumen para la barra inferior y la pantalla de sincronización. */
export function summarize(ops: QueuedOp[]) {
  return {
    pending: ops.filter((o) => o.status === "pendiente").length,
    errors: ops.filter((o) => o.status === "error").length,
  };
}
