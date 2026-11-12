"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/components/app-provider";
import { ScanInput } from "@/components/scan-input";
import { Button, Card, FormError, Input } from "@/components/ui";
import { cachedQuery, must } from "@/lib/offline/cached";
import { findByCode } from "@/lib/offline/catalog";
import { useCatalog } from "@/lib/offline/hooks";
import { enqueue } from "@/lib/offline/sync";
import { playSound } from "@/lib/sound";
import { supabaseBrowser } from "@/lib/supabase/client";
import { cn, formatQty } from "@/lib/utils";

type Item = { product_id: string; quantity_sent: number; product: { name: string; sku: string; unit: string } | null };
type Transfer = { id: string; number: string; status: string; note: string; from: { name: string } | null; items: Item[] };

/**
 * Recibir transferencia: escanea lo que llegó. Lo que falte se registra como
 * diferencia (merma) en el ERP; lo recibido entra al stock de esta tienda.
 */
export function ReceiveTransfer({ id }: { id: string }) {
  const router = useRouter();
  const { branch } = useApp();
  const { catalog } = useCatalog(branch.id);
  const [t, setT] = useState<Transfer | null | undefined>(undefined);
  const [got, setGot] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void cachedQuery(`transferencia:${id}`, async () =>
      must(
        await supabaseBrowser()
          .from("transfer_orders")
          .select("id, number, status, note, from:branches!transfer_orders_from_branch_fkey(name), items:transfer_order_items(product_id, quantity_sent, product:products(name, sku, unit))")
          .eq("id", id)
          .maybeSingle(),
      ) as unknown as Transfer | null,
    ).then(({ data }) => setT(data ?? null));
  }, [id]);

  if (t === undefined) return <p className="py-8 text-center text-sm text-slate-500">Cargando…</p>;
  if (t === null) return <p className="py-8 text-center text-sm text-slate-500">Transferencia no encontrada.</p>;
  const transfer = t;

  function onScan(code: string) {
    const p = findByCode(catalog, code);
    const item = p && transfer.items.find((i) => i.product_id === p.product_id);
    if (!item) {
      setError(p ? `«${p.name}» no viene en esta transferencia` : `El código ${code} no está registrado en el ERP`);
      playSound("error", { force: true });
      return;
    }
    setError(null);
    playSound("scan", { force: true });
    navigator.vibrate?.(40);
    setGot((g) => ({ ...g, [item.product_id]: (g[item.product_id] ?? 0) + 1 }));
  }

  const missing = transfer.items.filter((i) => (got[i.product_id] ?? 0) !== Number(i.quantity_sent));

  async function confirm() {
    setBusy(true);
    await enqueue({
      rpc: "rls_receive_transfer",
      args: { p_transfer: transfer.id, p_items: transfer.items.map((i) => ({ product_id: i.product_id, quantity: got[i.product_id] ?? 0 })), p_note: missing.length ? "Recibida con diferencias desde RLS Tools" : "" },
      kind: "recepcion-transferencia",
      summary: `Recepción ${transfer.number} desde ${transfer.from?.name ?? ""}${missing.length ? ` (${missing.length} con diferencia)` : ""}`,
      branchId: branch.id,
    });
    playSound("success", { force: true });
    toast.success("Recepción en cola: se aplica en el ERP en cuanto haya señal");
    router.replace("/transferencias/recibir");
  }

  if (transfer.status !== "en_transito") {
    return (
      <Card className="mt-4 flex flex-col items-center p-6 text-center">
        <CheckCircle2 className="h-12 w-12 text-emerald-600" />
        <p className="mt-2 font-semibold">La transferencia {transfer.number} ya fue recibida.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3 pb-28">
      <Card className="p-3">
        <p className="font-mono text-lg font-black text-link">{transfer.number}</p>
        <p className="text-sm text-slate-600">
          Desde {transfer.from?.name} · {transfer.items.length} productos
        </p>
        {transfer.note && <p className="text-xs text-slate-500">{transfer.note}</p>}
      </Card>
      <ScanInput onScan={onScan} placeholder="Escanea lo que llegó…" />
      <FormError message={error} />
      <Card className="divide-y divide-slate-100">
        {transfer.items.map((i) => {
          const qty = got[i.product_id] ?? 0;
          const ok = qty === Number(i.quantity_sent);
          return (
            <div key={i.product_id} className={cn("flex items-center gap-2 px-3 py-2.5", ok && "bg-emerald-50")}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">{i.product?.name}</p>
                <p className="font-mono text-xs text-slate-500">
                  {i.product?.sku} · enviado {formatQty(i.quantity_sent)} {i.product?.unit}
                </p>
              </div>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={qty}
                onChange={(e) => setGot((g) => ({ ...g, [i.product_id]: Math.max(0, Number(e.target.value)) }))}
                className={cn("h-10 w-20 text-center font-mono", ok ? "border-emerald-400" : qty > 0 && "border-amber-400")}
                aria-label={`Recibido de ${i.product?.name}`}
              />
            </div>
          );
        })}
      </Card>
      <Button variant="ghost" className="w-full" onClick={() => setGot(Object.fromEntries(transfer.items.map((i) => [i.product_id, Number(i.quantity_sent)])))}>
        Llegó todo completo
      </Button>
      {missing.length > 0 && (
        <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {missing.length} productos no coinciden con lo enviado. La diferencia se registra en el ERP como merma o sobrante.
        </p>
      )}
      <div className="fixed inset-x-0 bottom-16 z-20 border-t border-slate-200 bg-surface/95 px-3 py-2 sm:left-1/2 sm:right-auto sm:w-[40rem] sm:-translate-x-1/2 sm:rounded-t-xl sm:border-x pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur">
        <Button className="h-12 w-full text-base" loading={busy} onClick={() => void confirm()}>
          Confirmar recepción
        </Button>
      </div>
    </div>
  );
}
