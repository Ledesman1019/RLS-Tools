"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Download, History } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { Badge, Button, Card, Select, StatCard } from "@/components/ui";
import { cachedQuery, must } from "@/lib/offline/cached";
import { STATUS, type CountSession } from "@/lib/sessions";
import { supabaseBrowser } from "@/lib/supabase/client";
import { cn, formatDateTime, formatQty, toCsv } from "@/lib/utils";

type Line = { session_id: string; product_id: string; counted: number; system_qty: number | null; unit_cost: number | null };
type Op = { id: string; kind: string; summary: string; created_at: string; user: { full_name: string } | null };
type Summary = CountSession & { products: number; missing: number; extra: number; value: number; missingValue: number; extraValue: number };

function download(name: string, rows: Record<string, unknown>[]) {
  const blob = new Blob(["﻿", toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** 05 · Reportes y diferencias: inventarios realizados y historial de operaciones. */
export function ReportsTool() {
  const { branch, money, settings } = useApp();
  const [tab, setTab] = useState<"inventarios" | "historial">("inventarios");
  const [sessions, setSessions] = useState<Summary[] | null>(null);
  const [ops, setOps] = useState<Op[] | null>(null);
  const [status, setStatus] = useState("");
  const [fromCache, setFromCache] = useState(false);

  useEffect(() => {
    void cachedQuery(`reportes:${branch.id}`, async () => {
      const supabase = supabaseBrowser();
      const s = must(
        await supabase
          .from("count_sessions")
          .select("id, number, name, zone, blind, full_count, status, created_at, closed_at, applied_at, note, creator:profiles!count_sessions_created_by_fkey(full_name)")
          .eq("branch_id", branch.id)
          .in("status", ["cerrada", "aplicada"])
          .order("created_at", { ascending: false })
          .limit(60),
      ) as unknown as CountSession[];
      const lines = s.length
        ? (must(await supabase.from("count_lines").select("session_id, product_id, counted, system_qty, unit_cost").in("session_id", s.map((x) => x.id)).limit(20000)) as Line[])
        : [];
      return s.map((session): Summary => {
        const byProduct = new Map<string, { counted: number; system: number; cost: number }>();
        for (const l of lines.filter((x) => x.session_id === session.id)) {
          const row = byProduct.get(l.product_id) ?? { counted: 0, system: Number(l.system_qty ?? 0), cost: Number(l.unit_cost ?? 0) };
          row.counted += Number(l.counted);
          byProduct.set(l.product_id, row);
        }
        const diffs = [...byProduct.values()].map((r) => ({ d: r.counted - r.system, v: (r.counted - r.system) * r.cost }));
        return {
          ...session,
          products: byProduct.size,
          missing: diffs.filter((x) => x.d < 0).length,
          extra: diffs.filter((x) => x.d > 0).length,
          value: diffs.reduce((a, x) => a + x.v, 0),
          missingValue: diffs.filter((x) => x.v < 0).reduce((a, x) => a + x.v, 0),
          extraValue: diffs.filter((x) => x.v > 0).reduce((a, x) => a + x.v, 0),
        };
      });
    }).then(({ data, fromCache }) => {
      setSessions(data ?? []);
      setFromCache(fromCache);
    });
    void cachedQuery(`historial:${branch.id}`, async () =>
      must(
        await supabaseBrowser()
          .from("mobile_operations")
          .select("id, kind, summary, created_at, user:profiles(full_name)")
          .eq("branch_id", branch.id)
          .order("created_at", { ascending: false })
          .limit(150),
      ) as unknown as Op[],
    ).then(({ data }) => setOps(data ?? []));
  }, [branch.id]);

  const shown = useMemo(() => (sessions ?? []).filter((s) => !status || s.status === status), [sessions, status]);
  const totals = {
    products: shown.reduce((a, s) => a + s.products, 0),
    missingValue: shown.reduce((a, s) => a + s.missingValue, 0),
    extraValue: shown.reduce((a, s) => a + s.extraValue, 0),
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-slate-100 p-1">
        {(["inventarios", "historial"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={cn("h-10 cursor-pointer rounded-lg text-sm font-semibold", tab === t ? "bg-surface text-slate-900 shadow-sm" : "text-slate-500")}>
            {t === "inventarios" ? "Inventarios" : "Historial"}
          </button>
        ))}
      </div>
      {fromCache && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Sin señal: datos guardados en el celular.</p>}

      {tab === "inventarios" ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Inventarios" value={String(shown.length)} />
            <StatCard label="Productos contados" value={formatQty(totals.products)} />
            <StatCard label="Faltantes (valor)" value={money(totals.missingValue)} tone="red" />
            <StatCard label="Sobrantes (valor)" value={money(totals.extraValue)} tone="amber" />
          </div>
          <div className="flex gap-2">
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="h-11 flex-1" aria-label="Estado">
              <option value="">Enviados y aplicados</option>
              <option value="cerrada">Por aplicar</option>
              <option value="aplicada">Aplicados</option>
            </Select>
            <Button
              variant="secondary"
              className="h-11"
              onClick={() =>
                download(
                  `inventarios_${branch.code}.csv`,
                  shown.map((s) => ({
                    Inventario: s.number,
                    Nombre: s.name,
                    Zona: s.zone || "Toda la sucursal",
                    Estado: STATUS[s.status].label,
                    Fecha: formatDateTime(s.created_at, settings.timezone),
                    Productos: s.products,
                    Faltantes: s.missing,
                    Sobrantes: s.extra,
                    "Diferencia valorizada": s.value.toFixed(2),
                  })),
                )
              }
            >
              <Download className="h-4 w-4" /> CSV
            </Button>
          </div>
          {sessions === null ? (
            <p className="py-8 text-center text-sm text-slate-500">Cargando…</p>
          ) : shown.length === 0 ? (
            <Card className="p-6 text-center text-sm text-slate-500">Aún no hay inventarios enviados.</Card>
          ) : (
            <Card className="divide-y divide-slate-100">
              {shown.map((s) => (
                <Link key={s.id} href={`/inventario/${s.id}`} className="flex items-center gap-3 px-3 py-3 active:bg-slate-50">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-link">{s.number}</span>
                      <Badge tone={STATUS[s.status].tone}>{STATUS[s.status].label}</Badge>
                    </span>
                    <span className="block truncate text-sm font-semibold text-slate-900">{s.name}</span>
                    <span className="block text-xs text-slate-500">
                      {s.products} productos · <span className="text-red-600">{s.missing} faltan</span> · <span className="text-amber-700">{s.extra} sobran</span>
                    </span>
                  </span>
                  <span className={cn("font-mono text-sm font-bold", s.value < 0 ? "text-red-600" : "text-slate-900")}>{money(s.value)}</span>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </Link>
              ))}
            </Card>
          )}
        </>
      ) : (
        <>
          <Button
            variant="secondary"
            className="h-11 w-full"
            onClick={() => download(`operaciones_${branch.code}.csv`, (ops ?? []).map((o) => ({ Fecha: formatDateTime(o.created_at, settings.timezone), Usuario: o.user?.full_name ?? "", Operación: o.summary })))}
          >
            <Download className="h-4 w-4" /> Exportar historial (CSV)
          </Button>
          {ops === null ? (
            <p className="py-8 text-center text-sm text-slate-500">Cargando…</p>
          ) : ops.length === 0 ? (
            <Card className="p-6 text-center text-sm text-slate-500">Sin operaciones registradas.</Card>
          ) : (
            <Card className="divide-y divide-slate-100">
              {ops.map((o) => (
                <div key={o.id} className="flex items-start gap-3 px-3 py-2.5">
                  <History className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <span className="min-w-0">
                    <span className="block text-sm text-slate-900">{o.summary}</span>
                    <span className="block text-xs text-slate-500">
                      {o.user?.full_name ?? "—"} · {formatDateTime(o.created_at, settings.timezone)}
                    </span>
                  </span>
                </div>
              ))}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
