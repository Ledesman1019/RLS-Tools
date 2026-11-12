"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, ClipboardCheck, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/components/app-provider";
import { Dialog, DialogFooter } from "@/components/dialog";
import { Badge, Button, Card, EmptyState, Field, FormError, Input, Select } from "@/components/ui";
import { useCatalog } from "@/lib/offline/hooks";
import { onOperation } from "@/lib/offline/sync";
import { fetchSessions, STATUS, type CountSession } from "@/lib/sessions";
import { supabaseBrowser } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/utils";

/** 02 · Inventario físico: sesiones por zona y su estado. */
export function SessionsList({ startNew }: { startNew: boolean }) {
  const { branch, can, settings } = useApp();
  const router = useRouter();
  const { catalog } = useCatalog(branch.id);
  const [rows, setRows] = useState<CountSession[] | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(startNew && can("inventario", "create"));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const load = useCallback(() => {
    void fetchSessions(branch.id).then(({ data, fromCache }) => {
      setRows(data ?? []);
      setFromCache(fromCache);
    });
  }, [branch.id]);
  useEffect(load, [load]);
  useEffect(() => onOperation(() => load()), [load]);

  const zones = useMemo(() => [...new Set((catalog?.locations ?? []).map((l) => l.zone).filter(Boolean))].sort(), [catalog]);
  const shown = (rows ?? []).filter(
    (s) => (!status || s.status === status) && (!query.trim() || `${s.number} ${s.name} ${s.zone}`.toLowerCase().includes(query.trim().toLowerCase())),
  );

  function create(form: FormData) {
    setError(null);
    if (!navigator.onLine) return setError("Para abrir un inventario necesitas señal. El conteo sí funciona sin señal.");
    startTransition(async () => {
      const { data, error } = await supabaseBrowser().rpc("rls_open_count", {
        p_op: crypto.randomUUID(),
        p_branch: branch.id,
        p_name: String(form.get("name") ?? ""),
        p_zone: String(form.get("zone") ?? ""),
        p_blind: form.get("blind") === "on",
        p_full: form.get("full") === "on",
      });
      if (error) return setError(error.message);
      const r = data as { session_id: string; number: string };
      toast.success(`Inventario ${r.number} abierto`);
      setOpen(false);
      router.push(`/escaneo?sesion=${r.session_id}`);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar inventario…" className="h-11 pl-9" />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Estado" className="h-11 w-36">
          <option value="">Todos</option>
          {Object.entries(STATUS).map(([k, s]) => (
            <option key={k} value={k}>
              {s.label}
            </option>
          ))}
        </Select>
      </div>
      {can("inventario", "create") && (
        <Button className="h-12 w-full" onClick={() => setOpen(true)}>
          <Plus className="h-5 w-5" /> Nuevo inventario
        </Button>
      )}
      {fromCache && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Sin señal: se muestra la última lista guardada.</p>}

      {rows === null ? (
        <p className="py-8 text-center text-sm text-slate-500">Cargando…</p>
      ) : shown.length === 0 ? (
        <Card>
          <EmptyState icon={<ClipboardCheck className="h-5 w-5" />} title="Sin inventarios" description="Crea uno para contar una zona o toda la sucursal." />
        </Card>
      ) : (
        <Card className="divide-y divide-slate-100">
          {shown.map((s) => (
            <Link key={s.id} href={`/inventario/${s.id}`} className="flex items-center gap-3 px-3 py-3 active:bg-slate-50">
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-link">{s.number}</span>
                  <Badge tone={STATUS[s.status].tone}>{STATUS[s.status].label}</Badge>
                </span>
                <span className="mt-0.5 block truncate text-sm font-semibold text-slate-900">{s.name}</span>
                <span className="block text-xs text-slate-500">
                  {s.zone || "Toda la sucursal"} · {formatDateTime(s.created_at, settings.timezone)}
                </span>
              </span>
              <ChevronRight className="h-5 w-5 text-slate-400" />
            </Link>
          ))}
        </Card>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title="Nuevo inventario" description={branch.name} size="sm">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            create(new FormData(e.currentTarget));
          }}
        >
          <Field label="Nombre *">
            <Input name="name" required minLength={3} maxLength={80} placeholder="Ej. Conteo de bebidas" className="h-11" />
          </Field>
          <Field label="Zona" hint="Solo se cuentan y comparan los productos ubicados en esa zona.">
            <Select name="zone" defaultValue="" className="h-11">
              <option value="">Toda la sucursal</option>
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </Select>
          </Field>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="blind" defaultChecked className="mt-0.5 h-5 w-5 accent-brand-600" />
            <span>
              <strong className="font-semibold">Conteo ciego</strong>
              <span className="block text-xs text-slate-500">Quien cuenta no ve el stock del ERP hasta cerrar (evita sesgos).</span>
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="full" className="mt-0.5 h-5 w-5 accent-brand-600" />
            <span>
              <strong className="font-semibold">Conteo completo</strong>
              <span className="block text-xs text-slate-500">Al cerrar, lo que tiene stock y no se contó se toma como faltante (0).</span>
            </span>
          </label>
          <FormError message={error} />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending}>
              Abrir y escanear
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
}
