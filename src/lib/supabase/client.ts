"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_KEY, SUPABASE_URL } from "./env";

let client: ReturnType<typeof createBrowserClient> | null = null;

/**
 * Cliente del navegador: el celular habla directo con la base del ERP.
 * Todo pasa por RLS y por las funciones del ERP, que validan permisos.
 */
export function supabaseBrowser() {
  client ??= createBrowserClient(SUPABASE_URL, SUPABASE_KEY);
  return client;
}
