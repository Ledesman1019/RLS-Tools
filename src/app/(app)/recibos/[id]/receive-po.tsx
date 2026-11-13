"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, EyeOff, Minus, Plus, ScanBarcode, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/components/app-provider";
import { ScanInput } from "@/components/scan-input";
import { Badge, Button, Card, Field, FormError, Input } from "@/components/ui";
import { downloadCatalog, findByCode } from "@/lib/offline/catalog";
import { useCatalog } from "@/lib/offline/hooks";
import { playSound } from "@/lib/sound";
import { supabaseBrowser } from "@/lib/supabase/client";
import { formatDateTime, formatQty } from "@/lib/utils";

type Item = {
  product_id: string;
  quantity: number;
  pack_unit: string;
  pack_size: number;
  product: { name: string; sku: string; unit: string; track_lots: boolean } | null;
};
type Po = { id: string; number: string; status: string; created_at: string; note: string; supplier: { name: string } | null; items: Item[] };
type Lot = { lot_number: string; expiry_date: string };
type Diff = { name: string; counted: number; ordered: number; unit: string };

/**
 * Recibir O/C a ciegas: el almacenero NO ve qué productos ni cuántos trae la
 * orden. Solo aparece lo que escanea, con lo que cuenta. Al terminar, se compara
 * con la orden: si todo coincide se recibe en el ERP; si no, se muestran las
 * diferencias para volver a contar (la orden se recibe completa).
 */
export function ReceivePo({ id }: { id: string }) {
  const router = useRouter();
  const { branch } = useApp();
  const { catalog } = useCatalog(branch.id);
  const [po, setPo] = useState<Po | null | undefined>(undefined);
  const [counted, setCounted] = useState<Record<string, number>>({});
  const [scanned, setScanned] = useState<string[]>([]);
  const [lots, setLots] = useState<Record<string, Lot>>({});
  const [diffs, setDiffs] = useState<Diff[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabaseBrowser()
      .from("purchases")
      .select("id, number, status, created_at, note, supplier:suppliers(name), items:purchase_items(product_id, quantity, pack_unit, pack_size, product:products(name, sku, unit, track_lots))")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }: { data: unknown }) => setPo((data as unknown as Po) ?? null));
  }, [id]);

  if (po === undefined) return <p className="py-8 text-center text-sm text-slate-500">Cargando…</p>;
  if (po === null) return <p className="py-8 text-center text-sm text-slate-500">Orden no encontrada o sin señal.</p>;
  const order = po;
  // Una línea por producto (la orden puede repetirlo); nunca se muestra antes de contar
  const lines = Object.values(
    order.items.reduce<Record<string, Item>>((acc, i) => {
      acc[i.product_id] = acc[i.product_id] ? { ...acc[i.product_id], quantity: Number(acc[i.product_id].quantity) + Number(i.quantity) } : { ...i, quantity: Number(i.quantity) };
      return acc;
    }, {}),
  );
  const byId = new Map(lines.map((l) => [l.product_id, l]));
  const open = order.status === "ordenada";

  function onScan(code: string) {
    setDiffs(null);
    const p = findByCode(catalog, code);
    const line = p && byId.get(p.product_id);
    if (!line) {
      setError(p ? `«${p.name}» no corresponde a esta orden: sepáralo y avisa a Compras` : `El código ${code} no está registrado en el ERP`);
      playSound("error", { force: true });
      return;
    }
    setError(null);
    playSound("scan", { force: true });
    navigator.vibrate?.(40);
    // Si se compró por empaque, cada lectura suma un empaque completo
    setCounted((c) => ({ ...c, [line.product_id]: (c[line.product_id] ?? 0) + (Number(line.pack_size) || 1) }));
    setScanned((s) => [line.product_id, ...s.filter((x) => x !== line.product_id)]);
  }

  const setQty = (pid: string, q: number) => {
    setDiffs(null);
    setCounted((c) => ({ ...c, [pid]: Math.max(0, q) }));
  };
  const remove = (pid: string) => {
    setDiffs(null);
    setCounted((c) => Object.fromEntries(Object.entries(c).filter(([k]) => k !== pid)));
    setScanned((s) => s.filter((x) => x !== pid));
  };

  async function finish() {
    setError(null);
    if (scanned.length === 0) return setError("Escanea los productos que llegaron");
    // Comparación con la orden (recién aquí se revela lo pedido)
    const found: Diff[] = lines
      .filter((l) => Math.abs((counted[l.product_id] ?? 0) - Number(l.quantity)) > 0.0001)
      .map((l) => ({ name: l.product?.name ?? "", counted: counted[l.product_id] ?? 0, ordered: Number(l.quantity), unit: l.product?.unit ?? "" }));
    if (found.length > 0) {
      playSound("error", { force: true });
      return setDiffs(found);
    }
    const lotLines = lines.filter((l) => l.product?.track_lots);
    for (const l of lotLines) {
      const lot = lots[l.product_id];
      if (!lot?.lot_number.trim() || !lot.expiry_date) return setError(`Indica el lote y vencimiento de «${l.product?.name}»`);
    }
    if (!navigator.onLine) return setError("Para recibir la orden necesitas señal: el ERP actualiza stock, costo y cuentas por pagar al momento.");
    setBusy(true);
    const { error } = await supabaseBrowser().rpc("receive_purchase", {
      p_purchase: order.id,
      p_lots: lotLines.length ? lotLines.map((l) => ({ product_id: l.product_id, ...lots[l.product_id] })) : null,
    });
    setBusy(false);
    if (error) {
      playSound("error", { force: true });
      return setError(error.message);
    }
    playSound("success", { force: true });
    toast.success(`Orden ${order.number} recibida en el ERP`);
    void downloadCatalog(branch.id).catch(() => undefined);
    router.replace("/recibos");
  }

  return (
    <div className="space-y-3 pb-28">
      <Card className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-mono text-lg font-black text-link">{order.number}</p>
            <p className="text-sm text-slate-800">{order.supplier?.name}</p>
            <p className="text-xs text-slate-500">{formatDateTime(order.created_at)}</p>
          </div>
          <Badge tone={open ? "amber" : order.status === "recibida" ? "green" : "red"}>{open ? "Por recibir" : order.status === "recibida" ? "Recibida" : "Anulada"}</Badge>
        </div>
        {open && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
            <EyeOff className="h-3.5 w-3.5" /> Recepción a ciegas: escanea todo lo que llegó; al terminar se compara con la orden.
          </p>
        )}
      </Card>

      {!open ? (
        <p className="py-6 text-center text-sm text-slate-500">Esta orden ya no está por recibir.</p>
      ) : (
        <>
          <ScanInput onScan={onScan} placeholder="Escanea lo que llegó…" />
          <FormError message={error} />

          {scanned.length === 0 ? (
            <Card className="flex flex-col items-center gap-2 p-6 text-center text-sm text-slate-500">
              <ScanBarcode className="h-10 w-10 text-slate-300" />
              Aún no hay productos contados. Escanéalos con la pistola o la cámara.
            </Card>
          ) : (
            <Card className="divide-y divide-slate-100">
              <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Contado · {scanned.length} productos</p>
              {scanned.map((pid) => {
                const l = byId.get(pid)!;
                const q = counted[pid] ?? 0;
                return (
                  <div key={pid} className="px-3 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-slate-900">{l.product?.name}</span>
                        <span className="font-mono text-xs text-slate-500">{l.product?.sku}</span>
                      </span>
                      <button type="button" aria-label={`Quitar ${l.product?.name}`} onClick={() => remove(pid)} className="cursor-pointer p-1 text-slate-400">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <button type="button" aria-label="Menos" onClick={() => setQty(pid, q - 1)} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-slate-300">
                        <Minus className="h-4 w-4" />
                      </button>
                      <Input type="number" inputMode="decimal" min={0} step="any" value={q} onChange={(e) => setQty(pid, Number(e.target.value))} className="h-9 w-24 text-center font-mono" aria-label={`Cantidad contada de ${l.product?.name}`} />
                      <button type="button" aria-label="Más" onClick={() => setQty(pid, q + 1)} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-slate-300">
                        <Plus className="h-4 w-4" />
                      </button>
                      <span className="text-xs text-slate-500">{l.product?.unit}</span>
                    </div>
                    {l.product?.track_lots && (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <Field label="Lote">
                          <Input value={lots[pid]?.lot_number ?? ""} onChange={(e) => setLots((x) => ({ ...x, [pid]: { expiry_date: x[pid]?.expiry_date ?? "", lot_number: e.target.value } }))} className="h-10 uppercase" />
                        </Field>
                        <Field label="Vence">
                          <Input type="date" value={lots[pid]?.expiry_date ?? ""} onChange={(e) => setLots((x) => ({ ...x, [pid]: { lot_number: x[pid]?.lot_number ?? "", expiry_date: e.target.value } }))} className="h-10" />
                        </Field>
                      </div>
                    )}
                  </div>
                );
              })}
            </Card>
          )}

          {diffs && (
            <Card className="border-amber-300 bg-amber-50 p-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                <AlertTriangle className="h-4 w-4" /> Lo contado no coincide con la orden
              </p>
              <ul className="mt-2 divide-y divide-amber-200 text-sm">
                {diffs.map((d) => (
                  <li key={d.name} className="flex justify-between gap-2 py-1.5">
                    <span className="min-w-0 truncate text-amber-950">{d.name}</span>
                    <span className="shrink-0 font-mono text-xs text-amber-900">
                      contado {formatQty(d.counted)} · pedido {formatQty(d.ordered)} {d.unit}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-amber-800">Vuelve a contar esos productos. Si de verdad llegó distinto, no recibas la orden y avisa a Compras para corregirla.</p>
            </Card>
          )}

          <div className="fixed inset-x-0 bottom-16 z-20 border-t border-slate-200 bg-surface/95 px-3 py-2 sm:left-1/2 sm:right-auto sm:w-[40rem] sm:-translate-x-1/2 sm:rounded-t-xl sm:border-x pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur">
            <Button className="h-12 w-full text-base" loading={busy} onClick={() => void finish()}>
              {diffs ? "Volver a comparar" : "Terminar conteo y recibir"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
