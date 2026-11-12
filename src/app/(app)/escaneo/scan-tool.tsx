"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ClipboardCheck, MapPin, PackageX, Plus } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { ScanInput } from "@/components/scan-input";
import { Badge, buttonClass, Card, EmptyState, Field, Input, Select } from "@/components/ui";
import { findByCode, findLocation } from "@/lib/offline/catalog";
import { useCatalog } from "@/lib/offline/hooks";
import { kvGet, kvSet } from "@/lib/offline/store";
import { enqueue } from "@/lib/offline/sync";
import { fetchSessions, type CountSession } from "@/lib/sessions";
import { playSound } from "@/lib/sound";
import { cn, formatQty } from "@/lib/utils";

type Scan = { id: string; code: string; name: string | null; qty: number; at: number; location: string | null };
type Tally = Record<string, { name: string; qty: number }>;

/**
 * 01 · Inventario con pistola. Cada lectura suma al inventario elegido (o fija
 * la cantidad), se valida contra el catálogo del celular y queda en cola para
 * el ERP: funciona aunque no haya señal en el almacén.
 */
export function ScanTool({ initialSession }: { initialSession?: string }) {
  const { branch } = useApp();
  const { catalog, loading } = useCatalog(branch.id);
  const [sessions, setSessions] = useState<CountSession[] | null>(null);
  const [sessionId, setSessionId] = useState(initialSession ?? "");
  const [locationId, setLocationId] = useState("");
  const [mode, setMode] = useState<"sumar" | "cantidad">("sumar");
  const [qty, setQty] = useState("1");
  const [scans, setScans] = useState<Scan[]>([]);
  const [tally, setTally] = useState<Tally>({});
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    void fetchSessions(branch.id, ["abierta"]).then(({ data }) => {
      setSessions(data ?? []);
      if (!initialSession && data?.length === 1) setSessionId(data[0].id);
    });
  }, [branch.id, initialSession]);

  useEffect(() => {
    if (!sessionId) return;
    void kvGet<Tally>(`tally:${sessionId}`).then((t) => setTally(t ?? {}));
  }, [sessionId]);

  const session = sessions?.find((s) => s.id === sessionId);
  const locations = useMemo(() => (catalog?.locations ?? []).filter((l) => !session?.zone || l.zone === session.zone), [catalog, session]);
  const location = catalog?.locations.find((l) => l.id === locationId);
  const totalUnits = Object.values(tally).reduce((s, t) => s + t.qty, 0);

  async function onScan(code: string) {
    if (!session) return;
    // ¿Es una etiqueta de ubicación? Cambia la ubicación actual
    const loc = findLocation(catalog, code);
    if (loc) {
      setLocationId(loc.id);
      setFlash({ ok: true, text: `Ubicación ${loc.code}${loc.zone ? ` · ${loc.zone}` : ""}` });
      playSound("success", { force: true });
      return;
    }
    const amount = mode === "sumar" ? 1 : Number(qty);
    if (!Number.isFinite(amount) || amount <= 0) {
      setFlash({ ok: false, text: "Ingresa una cantidad válida" });
      return;
    }
    const product = findByCode(catalog, code);
    await enqueue({
      rpc: "rls_count",
      args: { p_session: session.id, p_code: code, p_qty: amount, p_location: locationId || null, p_mode: "sumar" },
      kind: "conteo",
      summary: `${product?.name ?? `Código ${code}`} × ${amount} en ${session.number}`,
      branchId: branch.id,
    });
    const key = product?.product_id ?? `?${code}`;
    const next = { ...tally, [key]: { name: product?.name ?? `No registrado: ${code}`, qty: (tally[key]?.qty ?? 0) + amount } };
    setTally(next);
    await kvSet(`tally:${session.id}`, next);
    setScans((s) => [{ id: crypto.randomUUID(), code, name: product?.name ?? null, qty: amount, at: Date.now(), location: location?.code ?? null }, ...s].slice(0, 30));
    if (product) {
      playSound("scan", { force: true });
      navigator.vibrate?.(40);
      setFlash({ ok: true, text: `${product.name} · ${formatQty(next[key].qty)} ${product.unit}` });
    } else {
      playSound("error", { force: true });
      navigator.vibrate?.([80, 60, 80]);
      setFlash({ ok: false, text: `Código ${code} no está registrado en el ERP (se reporta)` });
    }
  }

  if (sessions === null || loading) return <p className="py-10 text-center text-sm text-slate-500">Preparando el catálogo…</p>;

  if (sessions.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<ClipboardCheck className="h-5 w-5" />}
          title="No hay inventarios abiertos"
          description="Abre un inventario físico para empezar a escanear."
          action={
            <Link href="/inventario?nuevo=1" className={buttonClass("primary")}>
              <Plus className="h-4 w-4" /> Nuevo inventario
            </Link>
          }
        />
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card className="space-y-3 p-3">
        <Field label="Inventario">
          <Select value={sessionId} onChange={(e) => setSessionId(e.target.value)} className="h-11">
            <option value="">Elige un inventario abierto…</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.number} · {s.name}
                {s.zone ? ` (${s.zone})` : ""}
              </option>
            ))}
          </Select>
        </Field>
        {session && (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Ubicación">
              <Select value={locationId} onChange={(e) => setLocationId(e.target.value)} className="h-11">
                <option value="">Sin ubicación</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.code}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Modo">
              <Select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} className="h-11">
                <option value="sumar">+1 por lectura</option>
                <option value="cantidad">Con cantidad</option>
              </Select>
            </Field>
            {mode === "cantidad" && (
              <Field label="Cantidad por lectura" className="col-span-2">
                <Input type="number" inputMode="decimal" min={0.001} step="any" value={qty} onChange={(e) => setQty(e.target.value)} className="h-11 text-lg" />
              </Field>
            )}
          </div>
        )}
      </Card>

      {session && (
        <>
          <ScanInput onScan={(c) => void onScan(c)} placeholder="Apunta la pistola y dispara…" />
          {flash && (
            <div
              role="status"
              className={cn("flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold", flash.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700")}
            >
              {flash.ok ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertTriangle className="h-5 w-5 shrink-0" />}
              {flash.text}
            </div>
          )}
          <div className="flex items-center justify-between px-1 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> {location ? location.code : "Sin ubicación"} · escanea una etiqueta de ubicación para cambiarla
            </span>
          </div>
          <Card>
            <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5">
              <p className="text-sm font-semibold text-slate-900">En este celular</p>
              <Badge tone="blue">
                {Object.keys(tally).length} productos · {formatQty(totalUnits)} und
              </Badge>
            </div>
            {scans.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-slate-500">Las lecturas aparecen aquí.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {scans.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 px-3 py-2.5">
                    {s.name ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" /> : <PackageX className="h-5 w-5 shrink-0 text-red-600" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-900">{s.name ?? "No registrado"}</span>
                      <span className="block font-mono text-xs text-slate-500">
                        {s.code}
                        {s.location && ` · ${s.location}`}
                      </span>
                    </span>
                    <span className="font-mono text-sm font-bold text-slate-900">+{formatQty(s.qty)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Link href={`/inventario/${session.id}`} className={cn(buttonClass("secondary"), "h-12 w-full")}>
            Ver el inventario {session.number}
          </Link>
        </>
      )}
    </div>
  );
}
