"use client";

import { supabaseBrowser } from "@/lib/supabase/client";
import type { CatalogProduct, Location } from "@/lib/types";
import { kvGet, kvSet } from "./store";

export type Catalog = { branchId: string; downloadedAt: number; products: CatalogProduct[]; locations: Location[] };

const key = (branchId: string) => `catalog:${branchId}`;
const PAGE = 1000;

/** Recepción de información de productos: catálogo, stock y ubicaciones de la sucursal. */
export async function downloadCatalog(branchId: string): Promise<Catalog> {
  const supabase = supabaseBrowser();
  const rows: Omit<CatalogProduct, "location_code" | "zone">[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("inventory_view")
      .select("product_id, sku, barcode, name, unit, price, cost, quantity, min_stock, active, category_name, track_lots, pack_unit, pack_size")
      .eq("branch_id", branchId)
      .order("name")
      .order("product_id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as typeof rows));
    if (!data || data.length < PAGE) break;
  }
  const [locRes, placeRes] = await Promise.all([
    supabase.from("warehouse_locations").select("id, code, zone, description").eq("branch_id", branchId).eq("active", true).order("code"),
    supabase.from("product_locations").select("product_id, location_id").eq("branch_id", branchId),
  ]);
  if (locRes.error) throw new Error(locRes.error.message);
  const locations = (locRes.data ?? []) as Location[];
  const byId = new Map(locations.map((l) => [l.id, l]));
  const place = new Map(((placeRes.data ?? []) as { product_id: string; location_id: string }[]).map((p) => [p.product_id, byId.get(p.location_id)]));

  const catalog: Catalog = {
    branchId,
    downloadedAt: Date.now(),
    locations,
    products: rows.map((r) => ({
      ...r,
      price: Number(r.price),
      cost: Number(r.cost),
      quantity: Number(r.quantity),
      min_stock: Number(r.min_stock),
      pack_size: Number(r.pack_size ?? 1),
      pack_unit: r.pack_unit ?? "",
      location_code: place.get(r.product_id)?.code ?? null,
      zone: place.get(r.product_id)?.zone ?? null,
    })),
  };
  await kvSet(key(branchId), catalog);
  return catalog;
}

export const savedCatalog = (branchId: string) => kvGet<Catalog>(key(branchId));

/** Busca por código de barras exacto o SKU (como el ERP). */
export function findByCode(catalog: Catalog | null | undefined, code: string): CatalogProduct | undefined {
  const c = code.trim();
  if (!catalog || !c) return undefined;
  return catalog.products.find((p) => p.barcode === c) ?? catalog.products.find((p) => p.sku.toUpperCase() === c.toUpperCase());
}

export function findLocation(catalog: Catalog | null | undefined, code: string): Location | undefined {
  const c = code.trim().toUpperCase();
  return catalog?.locations.find((l) => l.code === c);
}

/** Búsqueda por texto para la consulta rápida. */
export function search(catalog: Catalog | null | undefined, text: string, limit = 30): CatalogProduct[] {
  const q = text.trim().toLowerCase();
  if (!catalog || q.length < 2) return [];
  return catalog.products.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.barcode ?? "").includes(q)).slice(0, limit);
}
