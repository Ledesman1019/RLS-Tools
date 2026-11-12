"use client";

import { useEffect, useState } from "react";
import { MapPin, Store } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { ScanInput } from "@/components/scan-input";
import { Badge, Card } from "@/components/ui";
import { cachedQuery, must } from "@/lib/offline/cached";
import { findByCode } from "@/lib/offline/catalog";
import { useCatalog } from "@/lib/offline/hooks";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { CatalogProduct } from "@/lib/types";
import { cn, formatQty } from "@/lib/utils";

type StoreSummary = { id: string; code: string; name: string; products: number; low: number; out: number };
type Row = { branch_id: string; branch_name: string; quantity: number; low_stock: boolean; active: boolean };

/** Tiendas: resumen de stock de cada tienda y existencias de un producto en todas. */
export function StoresTool() {
  const { branch, branches } = useApp();
  const { catalog } = useCatalog(branch.id);
  const [stores, setStores] = useState<StoreSummary[] | null>(null);
  const [product, setProduct] = useState<CatalogProduct | null>(null);
  const [byStore, setByStore] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void cachedQuery("tiendas", async () => {
      const rows = must(await supabaseBrowser().from("inventory_view").select("branch_id, quantity, low_stock, active").eq("active", true).limit(50000)) as Row[];
      return branches.map((b) => {
        const mine = rows.filter((r) => r.branch_id === b.id);
        return { id: b.id, code: b.code, name: b.name, products: mine.filter((r) => Number(r.quantity) > 0).length, low: mine.filter((r) => r.low_stock && Number(r.quantity) > 0).length, out: mine.filter((r) => Number(r.quantity) <= 0).length };
      });
    }).then(({ data }) => setStores(data ?? []));
  }, [branches]);

  async function onScan(code: string) {
    const p = findByCode(catalog, code);
    if (!p) return setError(`El código ${code} no está registrado en el ERP`);
    setError(null);
    setProduct(p);
    setByStore(null);
    const { data } = await cachedQuery(`stock-tiendas:${p.product_id}`, async () =>
      must(await supabaseBrowser().from("inventory_view").select("branch_id, branch_name, quantity, low_stock, active").eq("product_id", p.product_id).order("branch_name")) as Row[],
    );
    setByStore(data ?? []);
  }

  return (
    <div className="space-y-3">
      <ScanInput onScan={(c) => void onScan(c)} placeholder="Escanea un producto para ver su stock por tienda…" />
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {product && (
        <Card>
          <p className="border-b border-slate-100 px-3 py-2.5">
            <span className="block font-semibold text-slate-900">{product.name}</span>
            <span className="font-mono text-xs text-slate-500">{product.sku}</span>
          </p>
          {byStore === null ? (
            <p className="px-3 py-4 text-sm text-slate-500">Consultando…</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {byStore.map((r) => (
                <li key={r.branch_id} className={cn("flex items-center justify-between px-3 py-2.5", r.branch_id === branch.id && "bg-brand-50")}>
                  <span className="text-sm">
                    {r.branch_name} {r.branch_id === branch.id && <Badge tone="blue">Aquí</Badge>}
                  </span>
                  <span className={cn("font-mono text-base font-bold", Number(r.quantity) <= 0 ? "text-red-600" : r.low_stock ? "text-amber-700" : "text-slate-900")}>
                    {formatQty(r.quantity)} <span className="text-xs font-normal text-slate-400">{product.unit}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <p className="px-1 pt-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Tiendas</p>
      {stores === null ? (
        <p className="py-6 text-center text-sm text-slate-500">Cargando…</p>
      ) : (
        <div className="grid gap-2">
          {stores.map((s) => (
            <Card key={s.id} className={cn("flex items-center gap-3 p-3", s.id === branch.id && "ring-2 ring-brand-500")}>
              <Store className="h-8 w-8 shrink-0 text-rose-500" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-900">{s.name}</p>
                <p className="flex items-center gap-1 text-xs text-slate-500">
                  <MapPin className="h-3 w-3" /> Código {s.code}
                </p>
              </div>
              <div className="text-right text-xs">
                <p className="font-mono font-bold text-slate-900">{s.products} con stock</p>
                <p className="text-amber-700">{s.low} por reponer</p>
                <p className="text-red-600">{s.out} agotados</p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
