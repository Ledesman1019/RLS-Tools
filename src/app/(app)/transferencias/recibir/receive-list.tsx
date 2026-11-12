"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, PackageCheck } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { Badge, Card, EmptyState } from "@/components/ui";
import { cachedQuery, must } from "@/lib/offline/cached";
import { supabaseBrowser } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/utils";

export type TransferRow = {
  id: string;
  number: string;
  status: string;
  note: string;
  created_at: string;
  from: { name: string } | null;
};

/** Transferencias que vienen a esta tienda y aún no se reciben. */
export function ReceiveList() {
  const { branch } = useApp();
  const [rows, setRows] = useState<TransferRow[] | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    void cachedQuery(`transferencias-por-recibir:${branch.id}`, async () =>
      must(
        await supabaseBrowser()
          .from("transfer_orders")
          .select("id, number, status, note, created_at, from:branches!transfer_orders_from_branch_fkey(name)")
          .eq("to_branch", branch.id)
          .eq("status", "en_transito")
          .order("created_at", { ascending: false })
          .limit(100),
      ) as unknown as TransferRow[],
    ).then(({ data, fromCache }) => {
      setRows(data ?? []);
      setOffline(fromCache);
    });
  }, [branch.id]);

  if (rows === null) return <p className="py-8 text-center text-sm text-slate-500">Cargando…</p>;
  if (rows.length === 0) return <EmptyState icon={<PackageCheck className="h-8 w-8" />} title="Nada en tránsito" description={`No hay transferencias por recibir en ${branch.name}.`} />;

  return (
    <div className="space-y-2">
      {offline && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Sin señal: lista guardada en el celular.</p>}
      <Card className="divide-y divide-slate-100">
        {rows.map((t) => (
          <Link key={t.id} href={`/transferencias/recibir/${t.id}`} className="flex items-center gap-3 px-3 py-3 active:bg-slate-50">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-sm font-bold text-link">{t.number}</p>
              <p className="truncate text-sm text-slate-700">Desde {t.from?.name ?? "—"}</p>
              <p className="text-xs text-slate-500">
                {formatDateTime(t.created_at)}
                {t.note && ` · ${t.note}`}
              </p>
            </div>
            <Badge tone="amber">En tránsito</Badge>
            <ChevronRight className="h-4 w-4 text-slate-400" />
          </Link>
        ))}
      </Card>
    </div>
  );
}
