"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/components/app-provider";
import { ScanCart, type CartLine } from "@/components/scan-cart";
import { Button, Card, Field, FormError, Input, Select } from "@/components/ui";
import { useCatalog } from "@/lib/offline/hooks";
import { enqueue } from "@/lib/offline/sync";
import { playSound } from "@/lib/sound";
import { formatQty } from "@/lib/utils";

/**
 * Nueva transferencia: la mercadería sale de esta tienda y queda «en tránsito»
 * hasta que la tienda destino la recibe. Funciona sin señal (cola del celular).
 */
export function SendTool() {
  const { branch, branches } = useApp();
  const { catalog } = useCatalog(branch.id);
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<CartLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const targets = branches.filter((b) => b.id !== branch.id && b.active);
  const items = lines.filter((l) => l.qty > 0);
  const units = items.reduce((s, l) => s + l.qty, 0);

  async function submit() {
    setError(null);
    if (!to) return setError("Elige la tienda destino");
    if (items.length === 0) return setError("Escanea los productos que envías");
    const over = items.find((l) => l.qty > l.product.quantity);
    if (over) return setError(`Solo hay ${formatQty(over.product.quantity)} de «${over.product.name}» en ${branch.name}`);
    setBusy(true);
    const dest = targets.find((b) => b.id === to)?.name ?? "";
    await enqueue({
      rpc: "rls_send_transfer",
      args: { p_from: branch.id, p_to: to, p_items: items.map((l) => ({ code: l.product.sku, quantity: l.qty })), p_note: note.trim() },
      kind: "transferencia",
      summary: `Transferencia a ${dest}: ${items.length} productos, ${formatQty(units)} unidades`,
      branchId: branch.id,
    });
    setBusy(false);
    playSound("success", { force: true });
    toast.success("Transferencia en cola: se envía al ERP en cuanto haya señal");
    setSent(dest);
    setLines([]);
    setNote("");
  }

  if (sent) {
    return (
      <Card className="mt-4 flex flex-col items-center p-6 text-center">
        <CheckCircle2 className="h-14 w-14 text-emerald-600" />
        <p className="mt-3 text-lg font-bold text-slate-900">Transferencia enviada</p>
        <p className="mt-1 text-sm text-slate-600">
          Queda en tránsito hasta que <strong>{sent}</strong> la reciba en «Recibir Transferencia».
        </p>
        <Button className="mt-5 h-12 w-full" onClick={() => setSent(null)}>
          Nueva transferencia
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-3 pb-28">
      <Card className="grid gap-2 p-3">
        <Field label={`Desde: ${branch.name} · Hacia`}>
          <Select value={to} onChange={(e) => setTo(e.target.value)} className="h-11">
            <option value="">Elige la tienda destino…</option>
            {targets.map((b) => (
              <option key={b.id} value={b.id}>
                {b.code} · {b.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Nota (opcional)">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Guía, transportista…" className="h-11" />
        </Field>
      </Card>
      <ScanCart catalog={catalog} lines={lines} onChange={setLines} placeholder="Escanea lo que envías…" />
      <FormError message={error} />
      <div className="fixed inset-x-0 bottom-16 z-20 border-t border-slate-200 bg-surface/95 px-3 py-2 sm:left-1/2 sm:right-auto sm:w-[40rem] sm:-translate-x-1/2 sm:rounded-t-xl sm:border-x pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur">
        <Button className="h-12 w-full text-base" loading={busy} onClick={() => void submit()}>
          Enviar · {items.length} productos · {formatQty(units)} u.
        </Button>
      </div>
    </div>
  );
}
