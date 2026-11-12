"use client";

import { useState } from "react";
import { Minus, PackageX, Plus, Search, Trash2 } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { ScanInput } from "@/components/scan-input";
import { Card, Input } from "@/components/ui";
import { findByCode, search, type Catalog } from "@/lib/offline/catalog";
import { playSound } from "@/lib/sound";
import type { CatalogProduct } from "@/lib/types";
import { formatQty } from "@/lib/utils";

export type CartLine = { product: CatalogProduct; qty: number };

/**
 * Lista de productos por escaneo: cada lectura suma 1 (o agrega el producto),
 * se valida contra el catálogo del celular y se ajusta la cantidad a mano.
 */
export function ScanCart({
  catalog,
  lines,
  onChange,
  showPrice = false,
  showStock = true,
  placeholder = "Escanea o escribe el código…",
}: {
  catalog: Catalog | null;
  lines: CartLine[];
  onChange: (lines: CartLine[]) => void;
  showPrice?: boolean;
  showStock?: boolean;
  placeholder?: string;
}) {
  const { money } = useApp();
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");

  function add(p: CatalogProduct, qty = 1) {
    const i = lines.findIndex((l) => l.product.product_id === p.product_id);
    onChange(i >= 0 ? lines.map((l, j) => (j === i ? { ...l, qty: l.qty + qty } : l)) : [{ product: p, qty }, ...lines]);
    setError(null);
    playSound("scan", { force: true });
    navigator.vibrate?.(40);
  }

  function onScan(code: string) {
    const p = findByCode(catalog, code);
    if (!p) {
      setError(`El código ${code} no está registrado en el ERP`);
      playSound("error", { force: true });
      return;
    }
    add(p);
  }

  const set = (id: string, qty: number) => onChange(lines.map((l) => (l.product.product_id === id ? { ...l, qty: Math.max(0, qty) } : l)));
  const results = search(catalog, text, 8);

  return (
    <div className="space-y-2">
      <ScanInput onScan={onScan} placeholder={placeholder} />
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="o busca por nombre" className="h-10 pl-9" />
        {results.length > 0 && (
          <ul className="absolute inset-x-0 top-full z-10 mt-1 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-surface shadow-pop">
            {results.map((p) => (
              <li key={p.product_id}>
                <button
                  type="button"
                  onClick={() => {
                    add(p);
                    setText("");
                  }}
                  className="flex w-full cursor-pointer justify-between gap-2 px-3 py-2.5 text-left text-sm active:bg-slate-50"
                >
                  <span className="truncate">{p.name}</span>
                  <span className="shrink-0 font-mono text-xs text-slate-500">{showPrice ? money(p.price) : formatQty(p.quantity)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {error && (
        <p className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          <PackageX className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}
      {lines.length > 0 && (
        <Card className="divide-y divide-slate-100">
          {lines.map((l) => (
            <div key={l.product.product_id} className="px-3 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-900">{l.product.name}</span>
                  <span className="font-mono text-xs text-slate-500">
                    {l.product.sku}
                    {showStock && ` · stock ${formatQty(l.product.quantity)}`}
                    {showPrice && ` · ${money(l.product.price)}`}
                  </span>
                </span>
                <button
                  type="button"
                  aria-label={`Quitar ${l.product.name}`}
                  onClick={() => onChange(lines.filter((x) => x.product.product_id !== l.product.product_id))}
                  className="cursor-pointer p-1 text-slate-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <button type="button" aria-label="Menos" onClick={() => set(l.product.product_id, l.qty - 1)} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-slate-300">
                  <Minus className="h-4 w-4" />
                </button>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={l.qty}
                  onChange={(e) => set(l.product.product_id, Number(e.target.value))}
                  className="h-9 w-20 text-center font-mono"
                  aria-label={`Cantidad de ${l.product.name}`}
                />
                <button type="button" aria-label="Más" onClick={() => set(l.product.product_id, l.qty + 1)} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-slate-300">
                  <Plus className="h-4 w-4" />
                </button>
                <span className="text-xs text-slate-500">{l.product.unit}</span>
                {showPrice && <span className="ml-auto font-mono text-sm font-bold">{money(l.qty * l.product.price)}</span>}
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
