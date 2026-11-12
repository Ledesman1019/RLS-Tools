"use client";

import { useEffect, useState } from "react";
import { Boxes, MapPin, PackageX, Search, Tag } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { ScanInput } from "@/components/scan-input";
import { Badge, Card, Input } from "@/components/ui";
import { findByCode, search } from "@/lib/offline/catalog";
import { useCatalog } from "@/lib/offline/hooks";
import { playSound } from "@/lib/sound";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { CatalogProduct } from "@/lib/types";
import { formatDate, formatQty } from "@/lib/utils";

type Lot = { lot_number: string; expiry_date: string | null; quantity: number };
type Remote = { branches: { branch_name: string; quantity: number }[]; lots: Lot[] } | null;

/** 03 · Consulta rápida: descripción, SKU, stock, precio, unidad y ubicación. */
export function LookupTool() {
  const { branch, money, can } = useApp();
  const { catalog, loading } = useCatalog(branch.id);
  const [product, setProduct] = useState<CatalogProduct | null>(null);
  const [notFound, setNotFound] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [remote, setRemote] = useState<Remote>(null);
  const showCost = can("inventario", "edit");

  useEffect(() => {
    if (!product || !navigator.onLine) return;
    let cancelled = false;
    const supabase = supabaseBrowser();
    void Promise.all([
      supabase.from("inventory_view").select("branch_name, quantity").eq("product_id", product.product_id).neq("branch_id", branch.id),
      supabase.from("lots").select("lot_number, expiry_date, quantity").eq("product_id", product.product_id).eq("branch_id", branch.id).gt("quantity", 0).order("expiry_date"),
    ]).then(([b, l]) => {
      if (!cancelled) setRemote({ branches: (b.data ?? []) as { branch_name: string; quantity: number }[], lots: (l.data ?? []) as Lot[] });
    });
    return () => {
      cancelled = true;
      setRemote(null);
    };
  }, [product, branch.id]);

  function onScan(code: string) {
    const p = findByCode(catalog, code);
    setText("");
    if (p) {
      setProduct(p);
      setNotFound(null);
      playSound("scan", { force: true });
    } else {
      setProduct(null);
      setNotFound(code);
      playSound("error", { force: true });
    }
  }

  const results = search(catalog, text);

  return (
    <div className="space-y-3">
      <ScanInput onScan={onScan} placeholder="Escanea el producto…" />
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="o busca por nombre o SKU" className="h-11 pl-9" />
        {results.length > 0 && (
          <ul className="absolute inset-x-0 top-full z-10 mt-1 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-surface shadow-pop">
            {results.map((p) => (
              <li key={p.product_id}>
                <button
                  type="button"
                  onClick={() => {
                    setProduct(p);
                    setNotFound(null);
                    setText("");
                  }}
                  className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2.5 text-left active:bg-slate-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-900">{p.name}</span>
                    <span className="font-mono text-xs text-slate-500">{p.sku}</span>
                  </span>
                  <span className="font-mono text-sm font-bold">{formatQty(p.quantity)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {loading && !catalog && <p className="py-6 text-center text-sm text-slate-500">Descargando catálogo…</p>}

      {notFound && (
        <Card className="flex items-center gap-3 p-4 text-red-700">
          <PackageX className="h-8 w-8 shrink-0" />
          <div>
            <p className="font-semibold">Código no registrado</p>
            <p className="font-mono text-sm">{notFound}</p>
            <p className="mt-1 text-xs text-slate-500">No existe en el catálogo del ERP. Si es nuevo, dalo de alta en el ERP.</p>
          </div>
        </Card>
      )}

      {product && (
        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-lg font-bold leading-tight text-slate-900">{product.name}</p>
              {!product.active && <Badge tone="red">Inactivo</Badge>}
            </div>
            <p className="mt-1 font-mono text-xs text-slate-500">
              SKU {product.sku}
              {product.barcode && ` · ${product.barcode}`}
            </p>
            {product.category_name && <p className="text-xs text-slate-500">{product.category_name}</p>}
          </div>
          <dl className="grid grid-cols-2 divide-x divide-y divide-slate-100 border-b border-slate-100">
            <Fact icon={<Boxes className="h-4 w-4" />} label={`Stock en ${branch.name}`} value={`${formatQty(product.quantity)} ${product.unit}`} warn={product.quantity <= product.min_stock} />
            <Fact icon={<Tag className="h-4 w-4" />} label="Precio de venta" value={money(product.price)} />
            <Fact icon={<MapPin className="h-4 w-4" />} label="Ubicación" value={product.location_code ? `${product.location_code}${product.zone ? ` · ${product.zone}` : ""}` : "Sin ubicar"} />
            <Fact label="Unidad / presentación" value={product.pack_unit && product.pack_size > 1 ? `${product.unit} · ${product.pack_unit} × ${formatQty(product.pack_size)}` : product.unit} />
            <Fact label="Stock mínimo" value={formatQty(product.min_stock)} />
            {showCost && <Fact label="Costo" value={money(product.cost)} />}
          </dl>
          {remote && (
            <div className="space-y-3 p-4 text-sm">
              {remote.branches.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Otras sucursales</p>
                  {remote.branches.map((b) => (
                    <p key={b.branch_name} className="flex justify-between">
                      <span>{b.branch_name}</span>
                      <span className="font-mono font-semibold">{formatQty(b.quantity)}</span>
                    </p>
                  ))}
                </div>
              )}
              {product.track_lots && remote.lots.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Lotes (sale primero el que vence antes)</p>
                  {remote.lots.map((l) => (
                    <p key={l.lot_number} className="flex justify-between">
                      <span className="font-mono">{l.lot_number}</span>
                      <span>
                        {formatDate(l.expiry_date)} · <strong className="font-mono">{formatQty(l.quantity)}</strong>
                      </span>
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function Fact({ label, value, icon, warn }: { label: string; value: string; icon?: React.ReactNode; warn?: boolean }) {
  return (
    <div className="p-3">
      <dt className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
        {icon}
        {label}
      </dt>
      <dd className={`mt-0.5 font-mono text-base font-bold ${warn ? "text-red-600" : "text-slate-900"}`}>{value}</dd>
    </div>
  );
}
