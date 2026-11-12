"use client";

import { useState } from "react";
import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, CheckCircle2, MapPin, PackageX, X } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/components/app-provider";
import { ScanInput } from "@/components/scan-input";
import { Button, Card, Field, FormError, Input, Select } from "@/components/ui";
import { findByCode, findLocation } from "@/lib/offline/catalog";
import { useCatalog } from "@/lib/offline/hooks";
import { enqueue } from "@/lib/offline/sync";
import { playSound } from "@/lib/sound";
import type { CatalogProduct } from "@/lib/types";
import { cn, formatQty } from "@/lib/utils";

type Kind = "entrada" | "salida" | "transferencia" | "ubicacion";

const KINDS: { key: Kind; label: string; icon: typeof ArrowDownToLine; hint: string }[] = [
  { key: "entrada", label: "Entrada", icon: ArrowDownToLine, hint: "Suma stock (devolución, hallazgo, reingreso)." },
  { key: "salida", label: "Salida", icon: ArrowUpFromLine, hint: "Resta stock (merma, rotura, consumo interno)." },
  { key: "transferencia", label: "Transferir", icon: ArrowLeftRight, hint: "Envía mercadería a otra sucursal." },
  { key: "ubicacion", label: "Ubicación", icon: MapPin, hint: "Cambia dónde está guardado el producto." },
];

const REASONS: Record<"entrada" | "salida", string[]> = {
  entrada: ["Devolución de cliente", "Hallazgo en almacén", "Reingreso de exhibición", "Corrección de registro"],
  salida: ["Merma por rotura", "Producto vencido", "Consumo interno", "Muestra o degustación", "Robo o pérdida"],
};

/** 04 · Movimientos de almacén validados por escaneo. Funcionan sin señal (cola). */
export function MovesTool() {
  const { branch, branches } = useApp();
  const { catalog } = useCatalog(branch.id);
  const [kind, setKind] = useState<Kind>("entrada");
  const [product, setProduct] = useState<CatalogProduct | null>(null);
  const [code, setCode] = useState("");
  const [qty, setQty] = useState("1");
  const [reason, setReason] = useState("");
  const [toBranch, setToBranch] = useState("");
  const [locationId, setLocationId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const others = branches.filter((b) => b.id !== branch.id);
  const location = catalog?.locations.find((l) => l.id === locationId);

  function onScan(c: string) {
    setError(null);
    // En «Ubicación», escanear la etiqueta del lugar la selecciona
    const loc = findLocation(catalog, c);
    if (loc && kind === "ubicacion" && product) {
      setLocationId(loc.id);
      playSound("success", { force: true });
      return;
    }
    const p = findByCode(catalog, c);
    if (!p) {
      setProduct(null);
      setError(`El código ${c} no corresponde a ningún producto del ERP`);
      playSound("error", { force: true });
      return;
    }
    setProduct(p);
    setCode(c);
    playSound("scan", { force: true });
  }

  async function submit() {
    if (!product) return;
    setError(null);
    const amount = Number(qty);
    if (kind !== "ubicacion" && (!Number.isFinite(amount) || amount <= 0)) return setError("Ingresa una cantidad válida");
    if ((kind === "entrada" || kind === "salida") && reason.trim().length < 3) return setError("Indica el motivo");
    if (kind === "salida" && amount > product.quantity) return setError(`Solo hay ${formatQty(product.quantity)} ${product.unit} según el último catálogo`);
    if (kind === "transferencia" && !toBranch) return setError("Elige la sucursal de destino");
    if (kind === "ubicacion" && !locationId) return setError("Escanea o elige la nueva ubicación");
    setBusy(true);
    const labels: Record<Kind, string> = {
      entrada: `Entrada de ${product.name} × ${amount}`,
      salida: `Salida de ${product.name} × ${amount}`,
      transferencia: `Transferir ${product.name} × ${amount} a ${others.find((b) => b.id === toBranch)?.name ?? ""}`,
      ubicacion: `Ubicar ${product.name} en ${location?.code ?? ""}`,
    };
    await enqueue({
      rpc: "rls_move",
      args: {
        p_kind: kind,
        p_code: code,
        p_branch: branch.id,
        p_qty: kind === "ubicacion" ? null : amount,
        p_to_branch: kind === "transferencia" ? toBranch : null,
        p_location: kind === "ubicacion" ? locationId : null,
        p_note: reason.trim(),
      },
      kind: "movimiento",
      summary: labels[kind],
      branchId: branch.id,
    });
    toast.success("Movimiento registrado", { description: navigator.onLine ? labels[kind] : "Se enviará al ERP cuando vuelva la señal" });
    setProduct(null);
    setQty("1");
    setLocationId("");
    setBusy(false);
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-1.5">
        {KINDS.map((k) => (
          <button
            key={k.key}
            type="button"
            onClick={() => {
              setKind(k.key);
              setError(null);
            }}
            aria-pressed={kind === k.key}
            className={cn(
              "flex cursor-pointer flex-col items-center gap-1 rounded-xl border py-2.5 text-xs font-semibold",
              kind === k.key ? "border-brand-500 bg-brand-50 text-link" : "border-slate-200 bg-surface text-slate-600",
            )}
          >
            <k.icon className="h-5 w-5" />
            {k.label}
          </button>
        ))}
      </div>
      <p className="px-1 text-xs text-slate-500">{KINDS.find((k) => k.key === kind)?.hint}</p>

      <ScanInput onScan={onScan} placeholder={product && kind === "ubicacion" ? "Escanea la etiqueta de la ubicación…" : "Escanea el producto…"} />
      <FormError message={error} />

      {product ? (
        <Card className="space-y-3 p-3">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold leading-tight text-slate-900">{product.name}</p>
              <p className="font-mono text-xs text-slate-500">
                {product.sku} · stock {formatQty(product.quantity)} {product.unit}
                {product.location_code && ` · ${product.location_code}`}
              </p>
            </div>
            <button type="button" onClick={() => setProduct(null)} aria-label="Quitar producto" className="cursor-pointer p-1 text-slate-400">
              <X className="h-5 w-5" />
            </button>
          </div>

          {kind !== "ubicacion" && (
            <Field label={`Cantidad (${product.unit})`}>
              <Input type="number" inputMode="decimal" min={0.001} step="any" value={qty} onChange={(e) => setQty(e.target.value)} className="h-12 text-lg" />
            </Field>
          )}
          {(kind === "entrada" || kind === "salida") && (
            <Field label="Motivo *">
              <Select value={REASONS[kind].includes(reason) ? reason : reason ? "otro" : ""} onChange={(e) => setReason(e.target.value === "otro" ? " " : e.target.value)} className="h-11">
                <option value="">Elige el motivo…</option>
                {REASONS[kind].map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
                <option value="otro">Otro…</option>
              </Select>
              {reason && !REASONS[kind].includes(reason) && (
                <Input value={reason.trimStart()} onChange={(e) => setReason(e.target.value)} placeholder="Describe el motivo" className="mt-2 h-11" maxLength={150} />
              )}
            </Field>
          )}
          {kind === "transferencia" && (
            <Field label="Sucursal de destino *">
              <Select value={toBranch} onChange={(e) => setToBranch(e.target.value)} className="h-11">
                <option value="">Elige…</option>
                {others.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {kind === "ubicacion" && (
            <Field label="Nueva ubicación *" hint="Escanea la etiqueta del estante o elígela.">
              <Select value={locationId} onChange={(e) => setLocationId(e.target.value)} className="h-11">
                <option value="">Elige…</option>
                {(catalog?.locations ?? []).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.code}
                    {l.zone ? ` · ${l.zone}` : ""}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Button className="h-12 w-full" loading={busy} onClick={() => void submit()}>
            Registrar {KINDS.find((k) => k.key === kind)?.label.toLowerCase()}
          </Button>
        </Card>
      ) : (
        <Card className="flex items-center gap-3 p-4 text-sm text-slate-500">
          <PackageX className="h-6 w-6 shrink-0 text-slate-300" />
          Escanea un producto para validar el movimiento.
        </Card>
      )}
    </div>
  );
}
