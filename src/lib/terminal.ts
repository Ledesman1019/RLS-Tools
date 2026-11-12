"use client";

const KEY = "rls-terminal";

/**
 * Número de terminal de este celular (ej. «T-4F2A»): identifica el equipo en
 * la barra superior y en la configuración. Se guarda en el propio celular.
 */
export function terminalId() {
  if (typeof window === "undefined") return "";
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = `T-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "T-----";
  }
}
