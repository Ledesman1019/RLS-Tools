"use client";

import { kvGet, kvSet } from "./store";

/**
 * Consulta al ERP con respaldo local: si hay señal trae datos frescos y los
 * guarda; si no, devuelve la última copia guardada en el celular.
 */
export async function cachedQuery<T>(key: string, fetcher: () => Promise<T>): Promise<{ data: T | null; fromCache: boolean; savedAt: number | null }> {
  try {
    const data = await fetcher();
    await kvSet(`q:${key}`, { data, savedAt: Date.now() });
    return { data, fromCache: false, savedAt: Date.now() };
  } catch {
    const saved = await kvGet<{ data: T; savedAt: number }>(`q:${key}`);
    return { data: saved?.data ?? null, fromCache: true, savedAt: saved?.savedAt ?? null };
  }
}

/** Convierte la respuesta de Supabase en excepción para que cachedQuery use la copia guardada. */
export function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}
