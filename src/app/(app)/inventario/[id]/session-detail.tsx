"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Ban, CheckCheck, PackageX, ScanBarcode, Send } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/components/app-provider";
import { Dialog, DialogFooter } from "@/components/dialog";
import { Badge, Button, buttonClass, Card, Field, Input, Select, StatCard } from "@/components/ui";
import { enqueue, onOperation } from "@/lib/offline/sync";
import { differences, fetchSession, STATUS, type CountLine, type CountSession } from "@/lib/sessions";
import { cn, formatDateTime, formatQty } from "@/lib/utils";

type Data = { session: CountSession; lines: CountLine[]; unknown: { code: string; quantity: number }[] };

/** Detalle del inventario: contado vs ERP, sobrantes, faltantes y acciones. */
export function SessionDetail({ id }: { id: string }) {
  const { branch, can, money, settings } = useApp();
  const [data, setData] = useState<Data | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [filter, setFilter] = useState<"todos" | "faltantes" | "sobrantes" | "cuadra">("todos");
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<"aplicar" | "anular" | null>(null);
  const [text, setText] = useState("");

  const load = useCallback(() => {
    void fetchSession(id).then(({ data, fromCache }) => {
      setData(data);
      setFromCache(fromCache);
    });
  }, [id]);
  useEffect(load, [load]);
  useEffect(() => onOperation(() => load()), [load]);

  const rows = useMemo(() => (data ? differences(data.lines) : []), [data]);
  if (!data) return <p className="py-10 text-center text-sm text-slate-500">Cargando…</p>;
  const { session, unknown } = data;
  // Conteo ciego: mientras se cuenta, no se muestra el stock del ERP
  const hidden = session.blind && session.status === "abierta";
  const missing = rows.filter((r) => (r.diff ?? 0) < 0);
  const extra = rows.filter((r) => (r.diff ?? 0) > 0);
  const value = rows.reduce((s, r) => s + (r.value ?? 0), 0);
  const shown = rows
    .filter((r) => filter === "todos" || (filter === "faltantes" ? (r.diff ?? 0) < 0 : filter === "sobrantes" ? (r.diff ?? 0) > 0 : r.diff === 0))
    .filter((r) => !query.trim() || `${r.name} ${r.sku}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => Math.abs(b.value ?? 0) - Math.abs(a.value ?? 0));

  async function queue(rpc: string, args: Record<string, unknown>, summary: string, done: string) {
    await enqueue({ rpc, args, kind: "conteo", summary, branchId: branch.id });
    toast.success(done, { description: navigator.onLine ? undefined : "Se enviará al ERP cuando vuelva la señal" });
    setDialog(null);
    setText("");
  }

  return (
    <div className="space-y-3">
      <Card className="p-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold text-link">{session.number}</span>
          <Badge tone={STATUS[session.status].tone}>{STATUS[session.status].label}</Badge>
          {session.blind && <Badge>Ciego</Badge>}
        </div>
        <p className="mt-1 text-base font-bold text-slate-900">{session.name}</p>
        <p className="text-xs text-slate-500">
          {session.zone || "Toda la sucursal"} · por {session.creator?.full_name ?? "—"} · {formatDateTime(session.created_at, settings.timezone)}
        </p>
        {fromCache && <p className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800">Sin señal: datos guardados en el celular.</p>}
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Productos contados" value={String(rows.length)} />
        <StatCard label="Unidades" value={formatQty(rows.reduce((s, r) => s + r.counted, 0))} />
        {!hidden && session.status !== "abierta" && (
          <>
            <StatCard label="Faltantes" value={String(missing.length)} tone="red" />
            <StatCard label="Sobrantes" value={String(extra.length)} tone="amber" />
            <div className="col-span-2">
              <StatCard label="Diferencia valorizada (al costo)" value={money(value)} tone={value < 0 ? "red" : "green"} />
            </div>
          </>
        )}
      </div>

      <div className="grid gap-2">
        {session.status === "abierta" && can("inventario", "create") && (
          <>
            <Link href={`/escaneo?sesion=${session.id}`} className={cn(buttonClass("primary"), "h-12")}>
              <ScanBarcode className="h-5 w-5" /> Seguir contando
            </Link>
            <Button
              variant="success"
              className="h-12"
              onClick={() => {
                if (confirm(`¿Cerrar ${session.number} y enviarlo al ERP? Ya no se podrá contar.`))
                  void queue("rls_close_count", { p_session: session.id }, `Cerrar y enviar ${session.number}`, "Inventario cerrado y enviado");
              }}
            >
              <Send className="h-5 w-5" /> Cerrar y enviar al ERP
            </Button>
          </>
        )}
        {session.status === "cerrada" && can("inventario", "edit") && (
          <Button variant="success" className="h-12" onClick={() => setDialog("aplicar")}>
            <CheckCheck className="h-5 w-5" /> Aplicar ajustes al ERP
          </Button>
        )}
        {(session.status === "abierta" || session.status === "cerrada") && can("inventario", "create") && (
          <Button variant="secondary" className="h-11 text-red-600" onClick={() => setDialog("anular")}>
            <Ban className="h-4 w-4" /> Anular inventario
          </Button>
        )}
      </div>

      <Card>
        <div className="space-y-2 border-b border-slate-100 p-3">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar producto…" className="h-10" />
          {!hidden && session.status !== "abierta" && (
            <Select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="h-10">
              <option value="todos">Todos</option>
              <option value="faltantes">Faltantes</option>
              <option value="sobrantes">Sobrantes</option>
              <option value="cuadra">Cuadran</option>
            </Select>
          )}
        </div>
        {shown.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-slate-500">Sin productos en esta vista.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {shown.map((r) => (
              <li key={r.product_id} className="px-3 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-900">{r.name}</span>
                    <span className="block font-mono text-xs text-slate-500">
                      {r.sku}
                      {r.locations.length > 0 && ` · ${[...new Set(r.locations)].join(", ")}`}
                    </span>
                  </span>
                  {r.diff !== null && !hidden && (
                    <Badge tone={r.diff === 0 ? "green" : r.diff < 0 ? "red" : "amber"}>{r.diff === 0 ? "Cuadra" : `${r.diff > 0 ? "+" : ""}${formatQty(r.diff)}`}</Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  Contado <strong className="font-mono">{formatQty(r.counted)}</strong> {r.unit}
                  {!hidden && r.system !== null && (
                    <>
                      {" "}
                      · ERP <strong className="font-mono">{formatQty(r.system)}</strong>
                      {r.value ? ` · ${money(r.value)}` : ""}
                    </>
                  )}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {unknown.length > 0 && (
        <Card>
          <p className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5 text-sm font-semibold text-red-700">
            <PackageX className="h-4 w-4" /> Códigos no registrados en el ERP ({unknown.length})
          </p>
          <ul className="divide-y divide-slate-100">
            {unknown.map((u) => (
              <li key={u.code} className="flex justify-between px-3 py-2 font-mono text-sm">
                <span>{u.code}</span>
                <span className="font-bold">{formatQty(u.quantity)}</span>
              </li>
            ))}
          </ul>
          <p className="px-3 pb-3 text-xs text-slate-500">Dalos de alta en el ERP (Inventario → Nuevo producto) y vuelve a contarlos.</p>
        </Card>
      )}

      <Dialog open={dialog === "aplicar"} onClose={() => setDialog(null)} title={`Aplicar ${session.number}`} description="Se ajusta el stock del ERP con la diferencia contada. Queda en el kardex y en la contabilidad." size="sm">
        <Field label="Referencia (opcional)">
          <Input value={text} onChange={(e) => setText(e.target.value)} maxLength={120} placeholder="Ej. Conteo mensual" className="h-11" />
        </Field>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setDialog(null)}>
            Cancelar
          </Button>
          <Button variant="success" onClick={() => void queue("rls_apply_count", { p_session: session.id, p_note: text }, `Aplicar ${session.number}`, "Ajustes enviados al ERP")}>
            Aplicar ajustes
          </Button>
        </DialogFooter>
      </Dialog>
      <Dialog open={dialog === "anular"} onClose={() => setDialog(null)} title={`Anular ${session.number}`} size="sm">
        <Field label="Motivo *">
          <Input value={text} onChange={(e) => setText(e.target.value)} minLength={5} maxLength={150} className="h-11" />
        </Field>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setDialog(null)}>
            Volver
          </Button>
          <Button
            variant="danger"
            disabled={text.trim().length < 5}
            onClick={() => void queue("rls_cancel_count", { p_session: session.id, p_reason: text }, `Anular ${session.number}`, "Inventario anulado")}
          >
            Anular
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
