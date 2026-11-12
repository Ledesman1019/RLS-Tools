"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { downloadCatalog, savedCatalog, type Catalog } from "./catalog";
import { startSync, syncStore } from "./sync";

/** Estado de la sincronización (señal, pendientes, errores). */
export function useSync() {
  useEffect(() => startSync(), []);
  return useSyncExternalStore(syncStore.subscribe, syncStore.get, syncStore.server);
}

const STALE_MS = 30 * 60_000;

/**
 * Catálogo de la sucursal guardado en el celular. Se descarga al entrar si no
 * existe o tiene más de 30 minutos y hay señal; sin señal se usa el guardado.
 */
export function useCatalog(branchId: string) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCatalog(await downloadCatalog(branchId));
    } catch (e) {
      setError(navigator.onLine ? (e as Error).message : "Sin señal: se usa el catálogo guardado en el celular");
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    let cancelled = false;
    void savedCatalog(branchId).then((saved) => {
      if (cancelled) return;
      if (saved) setCatalog(saved);
      if (!saved || (Date.now() - saved.downloadedAt > STALE_MS && navigator.onLine)) void refresh();
      else setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [branchId, refresh]);

  return { catalog, loading, error, refresh };
}
