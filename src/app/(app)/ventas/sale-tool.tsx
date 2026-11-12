"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, UserSearch } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/components/app-provider";
import { ScanCart, type CartLine } from "@/components/scan-cart";
import { Button, Card, Field, FormError, Input, Select } from "@/components/ui";
import { useCatalog } from "@/lib/offline/hooks";
import { playSound } from "@/lib/sound";
import { supabaseBrowser } from "@/lib/supabase/client";
import { cn, round2 } from "@/lib/utils";

type Customer = { id: string; name: string; doc_type: string; doc_number: string };
type Done = { number: string; total: number; change: number | null; kind: "venta" | "orden" };

/**
 * Nueva venta (cobro en el celular, con caja abierta) o Nueva orden (cotización
 * que el cajero cobra en el ERP). Se registran en línea: validan stock, precio y caja en el ERP.
 */
export function SaleTool({ mode }: { mode: "venta" | "orden" }) {
  const { branch, money } = useApp();
  const { catalog } = useCatalog(branch.id);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [doc, setDoc] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [docType, setDocType] = useState<"boleta" | "ticket" | "factura">("boleta");
  const [method, setMethod] = useState("efectivo");
  const [received, setReceived] = useState("");
  const [validDays, setValidDays] = useState("7");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [pending, start] = useTransition();

  const items = lines.filter((l) => l.qty > 0);
  const total = round2(items.reduce((s, l) => s + l.qty * l.product.price, 0));

  function findCustomer() {
    setError(null);
    start(async () => {
      const { data } = await supabaseBrowser().from("customers").select("id, name, doc_type, doc_number").eq("doc_number", doc.trim()).eq("active", true).maybeSingle();
      if (!data) return setError("No hay un cliente con ese documento. Regístralo en el ERP o vende sin cliente.");
      setCustomer(data as Customer);
      if ((data as Customer).doc_type === "RUC") setDocType("factura");
    });
  }

  function submit() {
    setError(null);
    if (!navigator.onLine) return setError("Para registrar ventas y órdenes necesitas señal: el ERP valida stock y precios al momento.");
    if (items.length === 0) return setError("Escanea al menos un producto");
    if (mode === "venta" && docType === "factura" && customer?.doc_type !== "RUC") return setError("La factura requiere un cliente con RUC");
    if (mode === "venta" && method === "efectivo" && Number(received || 0) < total) return setError("El monto recibido es menor al total");
    start(async () => {
      const supabase = supabaseBrowser();
      const payload = items.map((l) => ({ product_id: l.product.product_id, quantity: l.qty }));
      if (mode === "venta") {
        const { data, error } = await supabase.rpc("create_sale", {
          p_branch: branch.id,
          p_customer: customer?.id ?? null,
          p_doc_type: docType,
          p_payment_method: method,
          p_amount_received: method === "efectivo" ? Number(received || 0) : 0,
          p_discount: 0,
          p_items: payload,
        });
        if (error) return setError(error.message);
        // Igual que en el ERP: el comprobante electrónico queda emitido para enviarlo desde Facturación
        await supabase.rpc("issue_e_document", { p_sale: data });
        const { data: sale } = await supabase.from("sales").select("number, total, change_amount").eq("id", data as string).single();
        setDone({ number: sale?.number ?? "", total: Number(sale?.total ?? total), change: Number(sale?.change_amount ?? 0), kind: "venta" });
      } else {
        const { data, error } = await supabase.rpc("create_quotation", {
          p_branch: branch.id,
          p_customer: customer?.id ?? null,
          p_valid_days: Number(validDays) || 7,
          p_discount: 0,
          p_note: "Desde RLS Tools",
          p_items: payload,
        });
        if (error) return setError(error.message);
        const { data: q } = await supabase.from("quotations").select("number, total").eq("id", data as string).single();
        setDone({ number: q?.number ?? "", total: Number(q?.total ?? total), change: null, kind: "orden" });
      }
      playSound("success", { force: true });
      toast.success(mode === "venta" ? "Venta registrada en el ERP" : "Orden registrada en el ERP");
      setLines([]);
      setCustomer(null);
      setDoc("");
      setReceived("");
    });
  }

  if (done) {
    return (
      <Card className="mt-4 flex flex-col items-center p-6 text-center">
        <CheckCircle2 className="h-14 w-14 text-emerald-600" />
        <p className="mt-3 text-lg font-bold text-slate-900">{done.kind === "venta" ? "Venta registrada" : "Orden de venta registrada"}</p>
        <p className="font-mono text-2xl font-black text-link">{done.number}</p>
        <p className="mt-2 text-sm text-slate-600">Total {money(done.total)}</p>
        {done.change !== null && done.change > 0 && <p className="text-base font-bold text-slate-900">Vuelto: {money(done.change)}</p>}
        {done.kind === "orden" && <p className="mt-2 text-xs text-slate-500">El cajero la cobra en el ERP (Caja → Cobrar órdenes de venta). La comisión es tuya.</p>}
        <Button className="mt-5 h-12 w-full" onClick={() => setDone(null)}>
          {done.kind === "venta" ? "Nueva venta" : "Nueva orden"}
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-3 pb-28">
      <ScanCart catalog={catalog} lines={lines} onChange={setLines} showPrice placeholder="Escanea los productos…" />

      <Card className="space-y-3 p-3">
        <Field label="Cliente (opcional)">
          {customer ? (
            <div className="flex items-center justify-between rounded-lg bg-brand-50 px-3 py-2 text-sm">
              <span>
                <strong className="font-semibold">{customer.name}</strong>
                <span className="block font-mono text-xs text-slate-500">
                  {customer.doc_type} {customer.doc_number}
                </span>
              </span>
              <button type="button" className="cursor-pointer text-xs font-semibold text-link" onClick={() => setCustomer(null)}>
                Quitar
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input value={doc} onChange={(e) => setDoc(e.target.value)} inputMode="numeric" placeholder="DNI o RUC" className="h-11" />
              <Button variant="secondary" className="h-11" disabled={!doc.trim()} onClick={findCustomer}>
                <UserSearch className="h-4 w-4" />
              </Button>
            </div>
          )}
        </Field>
        {mode === "venta" ? (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Comprobante">
              <Select value={docType} onChange={(e) => setDocType(e.target.value as typeof docType)} className="h-11">
                <option value="boleta">Boleta</option>
                <option value="factura">Factura</option>
                <option value="ticket">Ticket</option>
              </Select>
            </Field>
            <Field label="Pago">
              <Select value={method} onChange={(e) => setMethod(e.target.value)} className="h-11">
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="yape">Yape</option>
                <option value="plin">Plin</option>
              </Select>
            </Field>
            {method === "efectivo" && (
              <Field label="Recibido" className="col-span-2">
                <Input type="number" inputMode="decimal" min={0} step="0.1" value={received} onChange={(e) => setReceived(e.target.value)} placeholder={String(total)} className="h-11 text-lg" />
              </Field>
            )}
          </div>
        ) : (
          <Field label="Vigencia (días)">
            <Input type="number" inputMode="numeric" min={1} max={30} value={validDays} onChange={(e) => setValidDays(e.target.value)} className="h-11" />
          </Field>
        )}
        <FormError message={error} />
        {mode === "venta" && (
          <p className="text-xs text-slate-500">
            Necesitas tu caja abierta en {branch.name}. Si no la tienes, ábrela en el ERP (Caja) o{" "}
            <Link href="/ventas/orden" className="font-semibold text-link">
              registra una orden
            </Link>
            .
          </p>
        )}
      </Card>

      <div className="fixed inset-x-0 bottom-16 z-20 border-t border-slate-200 bg-surface/95 px-3 py-2 sm:left-1/2 sm:right-auto sm:w-[40rem] sm:-translate-x-1/2 sm:rounded-t-xl sm:border-x pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur">
        <Button className={cn("h-12 w-full text-base")} loading={pending} onClick={submit}>
          {mode === "venta" ? "Cobrar" : "Registrar orden"} · {money(total)}
        </Button>
      </div>
    </div>
  );
}
