"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/components/app-provider";
import { Button, Card, EmptyState, FormError, Input } from "@/components/ui";
import { playSound } from "@/lib/sound";
import { supabaseBrowser } from "@/lib/supabase/client";
import { formatDateTime, formatQty } from "@/lib/utils";

type Req = {
  id: string;
  number: string;
  justification: string;
  created_at: string;
  requested_by: string;
  requester: { full_name: string } | null;
  items: { quantity: number; pack_unit: string; pack_size: number; product: { name: string; sku: string; unit: string } | null }[];
};

/** Autorizaciones: aprobar o rechazar las solicitudes de pedido pendientes de la tienda. */
export function ApprovalsTool() {
  const { branch, profile } = useApp();
  const [rows, setRows] = useState<Req[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    void supabaseBrowser()
      .from("purchase_requisitions")
      .select("id, number, justification, created_at, requested_by, requester:profiles!purchase_requisitions_requested_by_fkey(full_name), items:purchase_requisition_items(quantity, pack_unit, pack_size, product:products(name, sku, unit))")
      .eq("branch_id", branch.id)
      .eq("status", "pendiente")
      .order("created_at")
      .then(({ data, error }: { data: unknown; error: { message: string } | null }) => {
        if (error) setError(navigator.onLine ? error.message : "Sin señal: las autorizaciones necesitan conexión");
        setRows((data as unknown as Req[]) ?? []);
      });
  }, [branch.id, reload]);

  async function decide(r: Req, approve: boolean) {
    setError(null);
    if (!approve && !note.trim()) return setError("Indica el motivo del rechazo");
    setBusy(r.id);
    const { error } = await supabaseBrowser().rpc("decide_requisition", { p_id: r.id, p_approve: approve, p_note: note.trim() });
    setBusy(null);
    if (error) {
      playSound("error", { force: true });
      return setError(error.message);
    }
    playSound("success", { force: true });
    toast.success(`${r.number} ${approve ? "aprobada: Compras ya puede emitir la orden" : "rechazada"}`);
    setNote("");
    setOpen(null);
    setReload((n) => n + 1);
  }

  if (rows === null) return <p className="py-8 text-center text-sm text-slate-500">Cargando…</p>;
  return (
    <div className="space-y-3">
      <FormError message={error} />
      {rows.length === 0 ? (
        <EmptyState icon={<BadgeCheck className="h-8 w-8" />} title="Todo al día" description={`No hay solicitudes de pedido pendientes en ${branch.name}.`} />
      ) : (
        rows.map((r) => {
          const own = r.requested_by === profile.id && profile.role !== "admin";
          const expanded = open === r.id;
          return (
            <Card key={r.id} className="overflow-hidden">
              <button type="button" onClick={() => setOpen(expanded ? null : r.id)} className="flex w-full cursor-pointer items-center gap-3 px-3 py-3 text-left">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm font-bold text-link">{r.number}</p>
                  <p className="truncate text-sm text-slate-800">{r.requester?.full_name ?? "—"}</p>
                  <p className="text-xs text-slate-500">
                    {formatDateTime(r.created_at)} · {r.items.length} productos
                  </p>
                </div>
                {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </button>
              {expanded && (
                <div className="space-y-2 border-t border-slate-100 px-3 py-3">
                  {r.justification && <p className="text-sm text-slate-600">«{r.justification}»</p>}
                  <ul className="divide-y divide-slate-100 rounded-lg bg-slate-50 text-sm">
                    {r.items.map((i, k) => (
                      <li key={k} className="flex justify-between gap-2 px-3 py-2">
                        <span className="truncate">{i.product?.name}</span>
                        <span className="shrink-0 font-mono">
                          {i.pack_unit && Number(i.pack_size) > 1 ? `${formatQty(Number(i.quantity) / Number(i.pack_size))} ${i.pack_unit}` : `${formatQty(i.quantity)} ${i.product?.unit ?? ""}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {own ? (
                    <p className="text-xs text-amber-800">Es tu propia solicitud: debe aprobarla otra persona.</p>
                  ) : (
                    <>
                      <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota (obligatoria para rechazar)" className="h-11" />
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="secondary" className="h-11" disabled={busy !== null} onClick={() => void decide(r, false)}>
                          Rechazar
                        </Button>
                        <Button className="h-11" loading={busy === r.id} onClick={() => void decide(r, true)}>
                          Aprobar
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
}
