"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Cloud, CloudOff, Database, ExternalLink, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/components/app-provider";
import { InstallAppButton } from "@/components/pwa";
import { Badge, Button, Card, StatCard } from "@/components/ui";
import { useCatalog, useSync } from "@/lib/offline/hooks";
import { discardOp, history, onOperation, pendingOps, retryOp, syncNow, type DoneOp } from "@/lib/offline/sync";
import type { QueuedOp } from "@/lib/offline/sync-logic";
import { cn, formatDateTime } from "@/lib/utils";

/**
 * 06 · Sincronización con el ERP HANA4: qué falta enviar, qué rechazó el ERP
 * (con su motivo), cuándo se recibió el catálogo y el historial enviado.
 */
export function SyncTool() {
  const { branch, settings, erpUrl } = useApp();
  const sync = useSync();
  const { catalog, loading, error: catalogError, refresh } = useCatalog(branch.id);
  const [queue, setQueue] = useState<QueuedOp[]>([]);
  const [sent, setSent] = useState<DoneOp[]>([]);

  const load = useCallback(() => {
    void pendingOps().then((ops) => setQueue(ops.sort((a, b) => a.createdAt - b.createdAt)));
    void history().then(setSent);
  }, []);
  useEffect(load, [load]);
  useEffect(() => onOperation(() => load()), [load]);
  useEffect(load, [sync.pending, sync.errors, load]);

  const errors = queue.filter((o) => o.status === "error");
  const waiting = queue.filter((o) => o.status === "pendiente");
  const at = (ms: number | null) => (ms ? formatDateTime(new Date(ms).toISOString(), settings.timezone) : "—");

  return (
    <div className="space-y-3">
      <Card className={cn("flex items-center gap-3 p-4", sync.online ? "" : "border-amber-300 bg-amber-50")}>
        {sync.online ? <Cloud className="h-8 w-8 text-emerald-600" /> : <CloudOff className="h-8 w-8 text-amber-600" />}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900">{sync.online ? "Conectado al ERP HANA4" : "Sin señal"}</p>
          <p className="text-xs text-slate-500">
            {sync.online ? `Última sincronización: ${at(sync.lastSync)}` : "Puedes seguir escaneando: todo se guarda en el celular y se envía al volver la señal."}
          </p>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Por enviar" value={String(sync.pending)} tone={sync.pending ? "amber" : "slate"} />
        <StatCard label="Con error" value={String(sync.errors)} tone={sync.errors ? "red" : "slate"} />
      </div>

      <Button className="h-12 w-full" loading={sync.syncing} disabled={!sync.online} onClick={() => void syncNow().then(load)}>
        <RefreshCw className="h-5 w-5" /> Sincronizar ahora
      </Button>

      {errors.length > 0 && (
        <Card>
          <p className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5 text-sm font-semibold text-red-700">
            <AlertTriangle className="h-4 w-4" /> Rechazadas por el ERP ({errors.length})
          </p>
          <ul className="divide-y divide-slate-100">
            {errors.map((o) => (
              <li key={o.id} className="space-y-2 px-3 py-3">
                <p className="text-sm font-medium text-slate-900">{o.summary}</p>
                <p className="rounded-md bg-red-50 px-2 py-1.5 text-xs text-red-700">{o.error}</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => void retryOp(o).then(load)}>
                    <RotateCcw className="h-3.5 w-3.5" /> Reintentar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600"
                    onClick={() => {
                      if (confirm("¿Descartar esta operación? No se enviará al ERP.")) void discardOp(o.id).then(load);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Descartar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {waiting.length > 0 && (
        <Card>
          <p className="border-b border-slate-100 px-3 py-2.5 text-sm font-semibold text-slate-900">Operaciones pendientes ({waiting.length})</p>
          <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
            {waiting.map((o) => (
              <li key={o.id} className="px-3 py-2 text-sm">
                <span className="block text-slate-900">{o.summary}</span>
                <span className="text-xs text-slate-500">
                  {at(o.createdAt)}
                  {o.attempts > 0 && ` · ${o.attempts} intentos`}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="p-4">
        <div className="flex items-start gap-3">
          <Database className="h-6 w-6 shrink-0 text-link" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-slate-900">Catálogo de {branch.name}</p>
            <p className="text-xs text-slate-500">
              {catalog ? `${catalog.products.length} productos · ${catalog.locations.length} ubicaciones · recibido ${at(catalog.downloadedAt)}` : "Aún no se descargó"}
            </p>
            {catalogError && <p className="mt-1 text-xs text-amber-700">{catalogError}</p>}
          </div>
        </div>
        <Button
          variant="secondary"
          className="mt-3 h-11 w-full"
          loading={loading}
          disabled={!sync.online}
          onClick={() => void refresh().then(() => toast.success("Catálogo actualizado desde el ERP"))}
        >
          <RefreshCw className="h-4 w-4" /> Recibir productos, stock y ubicaciones
        </Button>
      </Card>

      <Card>
        <p className="border-b border-slate-100 px-3 py-2.5 text-sm font-semibold text-slate-900">Enviado desde este celular</p>
        {sent.length === 0 ? (
          <p className="px-3 py-5 text-center text-sm text-slate-500">Nada enviado todavía.</p>
        ) : (
          <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
            {sent.slice(0, 60).map((o) => (
              <li key={o.id} className="flex items-start gap-2 px-3 py-2 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span className="min-w-0">
                  <span className="block text-slate-900">{o.summary}</span>
                  <span className="text-xs text-slate-500">
                    {at(o.at)}
                    {o.result?.repetida ? <Badge tone="neutral">ya estaba aplicada</Badge> : null}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <a href={erpUrl} target="_blank" rel="noreferrer" className="flex h-11 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-surface text-sm font-semibold text-slate-700">
          <ExternalLink className="h-4 w-4" /> Abrir el ERP
        </a>
        <InstallAppButton className="flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-surface text-sm font-semibold text-slate-700" />
      </div>
    </div>
  );
}
