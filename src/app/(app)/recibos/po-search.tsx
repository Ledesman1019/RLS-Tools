"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { ScanInput } from "@/components/scan-input";
import { Badge, Card, EmptyState, type BadgeTone } from "@/components/ui";
import { cachedQuery, must } from "@/lib/offline/cached";
import { supabaseBrowser } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/utils";

type Po = { id: string; number: string; status: string; created_at: string; expected_date: string | null; supplier: { name: string } | null };
const STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  ordenada: { label: "Por recibir", tone: "amber" },
  recibida: { label: "Recibida", tone: "green" },
  anulada: { label: "Anulada", tone: "red" },
};

/** Búsqueda O/C: órdenes de compra de la tienda (número, proveedor, fecha y estado). */
export function PoSearch() {
  const router = useRouter();
  const { branch } = useApp();
  const [rows, setRows] = useState<Po[] | null>(null);
  const [q, setQ] = useState("");
  const [all, setAll] = useState(false);

  useEffect(() => {
    void cachedQuery(`oc:${branch.id}`, async () =>
      must(
        await supabaseBrowser()
          .from("purchases")
          .select("id, number, status, created_at, expected_date, supplier:suppliers(name)")
          .eq("branch_id", branch.id)
          .order("created_at", { ascending: false })
          .limit(200),
      ) as unknown as Po[],
    ).then(({ data }) => setRows(data ?? []));
  }, [branch.id]);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (rows ?? []).filter((p) => (all || p.status === "ordenada") && (!term || p.number.toLowerCase().includes(term) || (p.supplier?.name ?? "").toLowerCase().includes(term)));
  }, [rows, q, all]);

  function onScan(code: string) {
    const hit = rows?.find((p) => p.number.toLowerCase() === code.trim().toLowerCase());
    if (hit) router.push(`/recibos/${hit.id}`);
    else setQ(code);
  }

  return (
    <div className="space-y-3">
      <ScanInput onScan={onScan} placeholder="Escanea o escribe el número de O/C…" />
      <div className="flex gap-2 text-sm">
        <button type="button" onClick={() => setAll(false)} className={`cursor-pointer rounded-full px-3 py-1 ${!all ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700"}`}>
          Por recibir
        </button>
        <button type="button" onClick={() => setAll(true)} className={`cursor-pointer rounded-full px-3 py-1 ${all ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700"}`}>
          Todas
        </button>
        {q && (
          <button type="button" onClick={() => setQ("")} className="ml-auto cursor-pointer text-xs font-semibold text-link">
            Quitar filtro «{q}»
          </button>
        )}
      </div>
      {rows === null ? (
        <p className="py-8 text-center text-sm text-slate-500">Cargando…</p>
      ) : shown.length === 0 ? (
        <EmptyState icon={<ClipboardList className="h-8 w-8" />} title="Sin órdenes" description={all ? "No hay órdenes de compra." : `No hay órdenes por recibir en ${branch.name}.`} />
      ) : (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-[1fr_auto] bg-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
            <span>Número · Proveedor</span>
            <span>Estado</span>
          </div>
          <div className="divide-y divide-slate-100">
            {shown.map((p) => (
              <Link key={p.id} href={`/recibos/${p.id}`} className="grid grid-cols-[1fr_auto] items-center gap-2 px-3 py-2.5 active:bg-slate-50">
                <span className="min-w-0">
                  <span className="block font-mono text-sm font-bold text-link">{p.number}</span>
                  <span className="block truncate text-sm text-slate-800">{p.supplier?.name}</span>
                  <span className="block text-xs text-slate-500">{formatDateTime(p.created_at)}</span>
                </span>
                <Badge tone={STATUS[p.status]?.tone ?? "neutral"}>{STATUS[p.status]?.label ?? p.status}</Badge>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
