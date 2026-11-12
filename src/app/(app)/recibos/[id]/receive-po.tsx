"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/components/app-provider";
import { ScanInput } from "@/components/scan-input";
import { Badge, Button, Card, Field, FormError, Input } from "@/components/ui";
import { findByCode } from "@/lib/offline/catalog";
import { useCatalog } from "@/lib/offline/hooks";
import { downloadCatalog } from "@/lib/offline/catalog";
import { playSound } from "@/lib/sound";
import { supabaseBrowser } from "@/lib/supabase/client";
import { cn, formatDateTime, formatQty } from "@/lib/utils";

type Item = {
  product_id: string;
  quantity: number;
  pack_unit: string;
  pack_size: number;
  product: { name: string; sku: string; unit: string; track_lots: boolean } | null;
};
type Po = { id: string; number: string; status: string; created_at: string; note: string; supplier: { name: string } | null; items: Item[] };
type Lot = { lot_number: string; expiry_date: string };

/**
 * Recibir O/C: verifica con la pistola lo que llegó contra la orden y la recibe
 * en el ERP (entra al stock, actualiza el costo y genera la cuenta por pagar).
 * La orden se recibe completa; si falta algo, se recibe en el ERP cuando llegue.
 */
export function ReceivePo({ id }: { id: string }) {
  const router = useRouter();
  const { branch } = useApp();
  const { catalog } = useCatalog(branch.id);
  const [po, setPo] = useState<Po | null | undefined>(undefined);
  const [checked, setChecked] = useState<Record<string, number>>({});
  const [lots, setLots] = useState<Record<string, Lot>>({});
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
  // Una línea por producto (la orden puede repetirlo)
  const lines = Object.values(
    order.items.reduce<Record<string, Item>>((acc, i) => {
      acc[i.product_id] = acc[i.product_id] ? { ...acc[i.product_id], quantity: Number(acc[i.product_id].quantity) + Number(i.quantity) } : { ...i, quantity: Number(i.quantity) };
      return acc;
    }, {}),
  );
  const pendingLines = lines.filter((l) => (checked[l.product_id] ?? 0) < l.quantity);
  const lotLines = lines.filter((l) => l.product?.track_lots);

  function onScan(code: string) {
    const p = findByCode(catalog, code);
    const line = p && lines.find((l) => l.product_id === p.product_id);
    if (!line) {
      setError(p ? `«${p.name}» no está en la orden ${order.number}` : `El código ${code} no está registrado en el ERP`);
      playSound("error", { force: true });
      return;
    }
    setError(null);
    playSound("scan", { force: true });
    navigator.vibrate?.(40);
    // Si se compró por empaque, cada lectura suma un empaque completo
    setChecked((c) => ({ ...c, [line.product_id]: (c[line.product_id] ?? 0) + (Number(line.pack_size) || 1) }));
  }

  async function receive() {
    setError(null);
    if (!navigator.onLine) return setError("Para recibir la orden necesitas señal: el ERP actualiza stock, costo y cuentas por pagar al momento.");
    for (const l of lotLines) {
      const lot = lots[l.product_id];
      if (!lot?.lot_number.trim() || !lot.expiry_date) return setError(`Indica el lote y vencimiento de «${l.product?.name}»`);
    }
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
          <Badge tone={order.status === "ordenada" ? "amber" : order.status === "recibida" ? "green" : "red"}>{order.status === "ordenada" ? "Por recibir" : order.status}</Badge>
        </div>
        {order.note && <p className="mt-1 text-xs text-slate-500">{order.note}</p>}
      </Card>

      {order.status === "ordenada" && <ScanInput onScan={onScan} placeholder="Escanea lo que llegó para verificar…" />}
      <FormError message={error} />

      <Card className="divide-y divide-slate-100">
        {lines.map((l) => {
          const qty = checked[l.product_id] ?? 0;
          const ok = qty >= l.quantity;
          const packs = l.pack_unit && Number(l.pack_size) > 1 ? ` (${formatQty(l.quantity / Number(l.pack_size))} ${l.pack_unit} x ${formatQty(l.pack_size)})` : "";
          return (
            <div key={l.product_id} className={cn("px-3 py-2.5", ok && "bg-emerald-50")}>
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{l.product?.name}</p>
                  <p className="font-mono text-xs text-slate-500">
                    {l.product?.sku} · pedido {formatQty(l.quantity)} {l.product?.unit}
                    {packs}
                  </p>
                </div>
                {order.status === "ordenada" &&
                  (ok ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <span className="font-mono text-sm font-bold text-slate-700">
                      {formatQty(qty)}/{formatQty(l.quantity)}
                    </span>
                  ))}
              </div>
              {order.status === "ordenada" && l.product?.track_lots && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Field label="Lote">
                    <Input value={lots[l.product_id]?.lot_number ?? ""} onChange={(e) => setLots((x) => ({ ...x, [l.product_id]: { expiry_date: x[l.product_id]?.expiry_date ?? "", lot_number: e.target.value } }))} className="h-10 uppercase" />
                  </Field>
                  <Field label="Vence">
                    <Input type="date" value={lots[l.product_id]?.expiry_date ?? ""} onChange={(e) => setLots((x) => ({ ...x, [l.product_id]: { lot_number: x[l.product_id]?.lot_number ?? "", expiry_date: e.target.value } }))} className="h-10" />
                  </Field>
                </div>
              )}
            </div>
          );
        })}
      </Card>

      {order.status === "ordenada" && (
        <>
          {pendingLines.length > 0 && (
            <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {pendingLines.length} productos aún no se verifican. La orden se recibe completa: si algo no llegó, no la recibas y avisa a Compras.
            </p>
          )}
          <div className="fixed inset-x-0 bottom-16 z-20 border-t border-slate-200 bg-surface/95 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur">
            <Button className="h-12 w-full text-base" loading={busy} onClick={() => void receive()}>
              {pendingLines.length ? "Recibir de todos modos" : "Recibir orden completa"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
