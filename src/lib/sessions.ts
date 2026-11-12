"use client";

import { supabaseBrowser } from "@/lib/supabase/client";
import { cachedQuery, must } from "@/lib/offline/cached";

export type CountSession = {
  id: string;
  number: string;
  name: string;
  zone: string;
  blind: boolean;
  full_count: boolean;
  status: "abierta" | "cerrada" | "aplicada" | "anulada";
  created_at: string;
  closed_at: string | null;
  applied_at: string | null;
  note: string;
  creator: { full_name: string } | null;
};

export type CountLine = {
  product_id: string;
  location_id: string | null;
  counted: number;
  system_qty: number | null;
  unit_cost: number | null;
  product: { name: string; sku: string; barcode: string | null; unit: string } | null;
  location: { code: string } | null;
};

export const STATUS: Record<CountSession["status"], { label: string; tone: "blue" | "amber" | "green" | "neutral" }> = {
  abierta: { label: "Contando", tone: "blue" },
  cerrada: { label: "Enviado al ERP", tone: "amber" },
  aplicada: { label: "Aplicado", tone: "green" },
  anulada: { label: "Anulado", tone: "neutral" },
};

const SESSION_FIELDS = "id, number, name, zone, blind, full_count, status, created_at, closed_at, applied_at, note, creator:profiles!count_sessions_created_by_fkey(full_name)";

export function fetchSessions(branchId: string, statuses?: CountSession["status"][]) {
  return cachedQuery(`sessions:${branchId}:${statuses?.join(",") ?? "todas"}`, async () => {
    let q = supabaseBrowser().from("count_sessions").select(SESSION_FIELDS).eq("branch_id", branchId).order("created_at", { ascending: false }).limit(100);
    if (statuses) q = q.in("status", statuses);
    return must(await q) as unknown as CountSession[];
  });
}

export function fetchSession(id: string) {
  return cachedQuery(`session:${id}`, async () => {
    const supabase = supabaseBrowser();
    const [session, lines, unknown] = await Promise.all([
      supabase.from("count_sessions").select(SESSION_FIELDS).eq("id", id).single(),
      supabase.from("count_lines").select("product_id, location_id, counted, system_qty, unit_cost, product:products(name, sku, barcode, unit), location:warehouse_locations(code)").eq("session_id", id),
      supabase.from("count_unknown_codes").select("code, quantity").eq("session_id", id),
    ]);
    return {
      session: must(session) as unknown as CountSession,
      lines: must(lines) as unknown as CountLine[],
      unknown: must(unknown) as { code: string; quantity: number }[],
    };
  });
}

/** Totales por producto (sumando ubicaciones) con su diferencia contra el ERP. */
export function differences(lines: CountLine[]) {
  const byProduct = new Map<string, { product_id: string; name: string; sku: string; unit: string; counted: number; system: number | null; cost: number; locations: string[] }>();
  for (const l of lines) {
    const row = byProduct.get(l.product_id) ?? {
      product_id: l.product_id,
      name: l.product?.name ?? "Producto",
      sku: l.product?.sku ?? "",
      unit: l.product?.unit ?? "",
      counted: 0,
      system: l.system_qty === null ? null : Number(l.system_qty),
      cost: Number(l.unit_cost ?? 0),
      locations: [],
    };
    row.counted += Number(l.counted);
    if (l.location?.code) row.locations.push(l.location.code);
    byProduct.set(l.product_id, row);
  }
  return [...byProduct.values()].map((r) => ({ ...r, diff: r.system === null ? null : r.counted - r.system, value: r.system === null ? null : (r.counted - r.system) * r.cost }));
}
