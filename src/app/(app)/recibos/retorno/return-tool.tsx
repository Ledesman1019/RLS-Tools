"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/components/app-provider";
import { ScanCart, type CartLine } from "@/components/scan-cart";
import { Button, Card, Field, FormError, Select } from "@/components/ui";
import { cachedQuery, must } from "@/lib/offline/cached";
import { useCatalog } from "@/lib/offline/hooks";
import { enqueue } from "@/lib/offline/sync";
import { playSound } from "@/lib/sound";
import { supabaseBrowser } from "@/lib/supabase/client";
import { formatQty } from "@/lib/utils";

type Supplier = { id: string; name: string };
type Po = { id: string; number: string; supplier_id: string };
const REASONS = ["Producto dañado", "Producto vencido o por vencer", "Error en el pedido", "Exceso de mercadería", "Defecto de fábrica"];

/**
 * Retorno a proveedor: la mercadería sale del stock y queda como reclamo al
 * proveedor (cuenta 1673) hasta que emita su nota de crédito. Funciona sin señal.
 */
export function ReturnTool() {
  const { branch } = useApp();
  const { catalog } = useCatalog(branch.id);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [pos, setPos] = useState<Po[]>([]);
  const [supplier, setSupplier] = useState("");
  const [purchase, setPurchase] = useState("");
  const [reason, setReason] = useState(REASONS[0]);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void cachedQuery("proveedores", async () => must(await supabaseBrowser().from("suppliers").select("id, name").eq("active", true).order("name")) as Supplier[]).then(({ data }) => setSuppliers(data ?? []));
    void cachedQuery(`oc-recibidas:${branch.id}`, async () =>
      must(await supabaseBrowser().from("purchases").select("id, number, supplier_id").eq("branch_id", branch.id).eq("status", "recibida").order("created_at", { ascending: false }).limit(200)) as Po[],
    ).then(({ data }) => setPos(data ?? []));
  }, [branch.id]);

  const items = lines.filter((l) => l.qty > 0);
  const units = items.reduce((s, l) => s + l.qty, 0);

  async function submit() {
    setError(null);
    if (!supplier) return setError("Elige el proveedor");
    if (items.length === 0) return setError("Escanea los productos que devuelves");
    const over = items.find((l) => l.qty > l.product.quantity);
    if (over) return setError(`Solo hay ${formatQty(over.product.quantity)} de «${over.product.name}» en stock`);
    setBusy(true);
    await enqueue({
      rpc: "rls_supplier_return",
      args: { p_branch: branch.id, p_supplier: supplier, p_purchase: purchase || null, p_items: items.map((l) => ({ code: l.product.sku, quantity: l.qty })), p_reason: reason },
      kind: "retorno-proveedor",
      summary: `Retorno a ${suppliers.find((s) => s.id === supplier)?.name ?? "proveedor"}: ${items.length} productos, ${formatQty(units)} u.`,
      branchId: branch.id,
    });
    setBusy(false);
    playSound("success", { force: true });
    toast.success("Retorno en cola: se registra en el ERP en cuanto haya señal");
    setDone(true);
    setLines([]);
  }

  if (done) {
    return (
      <Card className="mt-4 flex flex-col items-center p-6 text-center">
        <CheckCircle2 className="h-14 w-14 text-emerald-600" />
        <p className="mt-3 text-lg font-bold text-slate-900">Retorno registrado</p>
        <p className="mt-1 text-sm text-slate-600">La mercadería sale del stock. Cuentas por pagar descuenta el monto cuando llegue la nota de crédito del proveedor.</p>
        <Button className="mt-5 h-12 w-full" onClick={() => setDone(false)}>
          Nuevo retorno
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-3 pb-28">
      <Card className="grid gap-2 p-3">
        <Field label="Proveedor">
          <Select
            value={supplier}
            onChange={(e) => {
              setSupplier(e.target.value);
              setPurchase("");
            }}
            className="h-11"
          >
            <option value="">Elige el proveedor…</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Orden de compra (opcional)">
          <Select value={purchase} onChange={(e) => setPurchase(e.target.value)} className="h-11" disabled={!supplier}>
            <option value="">Sin orden</option>
            {pos
              .filter((p) => p.supplier_id === supplier)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.number}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Motivo">
          <Select value={reason} onChange={(e) => setReason(e.target.value)} className="h-11">
            {REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
        </Field>
      </Card>
      <ScanCart catalog={catalog} lines={lines} onChange={setLines} placeholder="Escanea lo que devuelves…" />
      <FormError message={error} />
      <div className="fixed inset-x-0 bottom-16 z-20 border-t border-slate-200 bg-surface/95 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur">
        <Button className="h-12 w-full text-base" loading={busy} onClick={() => void submit()}>
          Registrar retorno · {formatQty(units)} u.
        </Button>
      </div>
    </div>
  );
}
