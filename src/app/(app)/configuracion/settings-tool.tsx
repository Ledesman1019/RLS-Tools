"use client";

import { useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { Bell, ChevronRight, Cloud, Database, ExternalLink, Smartphone, Store, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { setBranch } from "@/app/actions";
import { useApp } from "@/components/app-provider";
import { InstallAppButton } from "@/components/pwa";
import { Button, buttonClass, Card, Select } from "@/components/ui";
import { useCatalog, useSync } from "@/lib/offline/hooks";
import { enableSystemNotifications, notify, notifyPermission, subscribeNotify, systemNotificationsOn } from "@/lib/notify";
import { playSound, setSoundEnabled, soundEnabled, subscribeSound } from "@/lib/sound";
import { terminalId } from "@/lib/terminal";
import { formatDateTime } from "@/lib/utils";

const VERSION = "1.2.0";
const noop = () => () => {};

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-3 py-3">
      <span className="text-slate-500">{icon}</span>
      <span className="flex-1 text-sm text-slate-700">{label}</span>
      <span className="text-right text-sm font-medium text-slate-900">{children}</span>
    </div>
  );
}

/** Configuración del terminal: tienda de trabajo, sonido, catálogo, instalación y datos del equipo. */
export function SettingsTool() {
  const { branch, branches, profile, roleName, settings, can, erpUrl } = useApp();
  const { catalog, loading, refresh } = useCatalog(branch.id);
  const sync = useSync();
  const sound = useSyncExternalStore(subscribeSound, soundEnabled, () => true);
  const notifications = useSyncExternalStore(subscribeNotify, systemNotificationsOn, () => false);
  const permission = useSyncExternalStore(subscribeNotify, notifyPermission, () => "default" as const);
  const terminal = useSyncExternalStore(noop, terminalId, () => "");
  const [pending, start] = useTransition();
  const multi = (can("reportes", "view") || can("configuracion", "view")) && branches.length > 1;

  return (
    <div className="space-y-3">
      <Card className="divide-y divide-slate-100">
        <Row icon={<Smartphone className="h-5 w-5" />} label="Terminal">
          <span className="font-mono">{terminal}</span>
        </Row>
        <Row icon={<Store className="h-5 w-5" />} label="Usuario">
          {profile.full_name}
          <span className="block text-xs font-normal text-slate-500">{roleName}</span>
        </Row>
        <div className="flex items-center gap-3 px-3 py-3">
          <Store className="h-5 w-5 text-slate-500" />
          <span className="flex-1 text-sm text-slate-700">Tienda</span>
          {multi ? (
            <Select
              value={branch.id}
              disabled={pending}
              onChange={(e) =>
                start(async () => {
                  await setBranch(e.target.value);
                  toast.success("Tienda cambiada");
                })
              }
              className="h-10 w-48"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code} · {b.name}
                </option>
              ))}
            </Select>
          ) : (
            <span className="text-sm font-medium text-slate-900">{branch.name}</span>
          )}
        </div>
      </Card>

      <Card className="divide-y divide-slate-100">
        <label className="flex cursor-pointer items-center gap-3 px-3 py-3">
          <Volume2 className="h-5 w-5 text-slate-500" />
          <span className="flex-1 text-sm text-slate-700">Sonido al escanear</span>
          <input
            type="checkbox"
            className="h-5 w-5 accent-brand-600"
            checked={sound}
            onChange={(e) => {
              setSoundEnabled(e.target.checked);
              if (e.target.checked) playSound("scan");
            }}
          />
        </label>
        <label className="flex cursor-pointer items-center gap-3 px-3 py-3">
          <Bell className="h-5 w-5 text-slate-500" />
          <span className="flex-1 text-sm text-slate-700">
            Notificaciones del celular
            <span className="block text-xs text-slate-500">
              {permission === "unsupported"
                ? "Este navegador no las permite: instala la app para recibirlas"
                : permission === "denied"
                  ? "Bloqueadas: actívalas en los permisos del navegador para este sitio"
                  : "Transferencias que llegan, O/C por recibir, aprobaciones y errores de envío"}
            </span>
          </span>
          <input
            type="checkbox"
            className="h-5 w-5 accent-brand-600"
            checked={notifications}
            disabled={permission === "unsupported" || permission === "denied"}
            onChange={(e) =>
              void enableSystemNotifications(e.target.checked).then((on) => {
                if (on) void notify({ title: "Notificaciones activadas", body: "Te avisaremos lo que llegue a tu tienda", tone: "success" });
              })
            }
          />
        </label>
        <button type="button" onClick={() => void notify({ title: "Prueba de aviso", body: "Así suenan las notificaciones de RLS Tools" })} className="flex w-full cursor-pointer items-center gap-3 px-3 py-3 text-left text-sm text-link active:bg-slate-50">
          <Volume2 className="h-5 w-5" /> Probar sonido y aviso
        </button>
        <div className="flex items-center gap-3 px-3 py-3">
          <Database className="h-5 w-5 text-slate-500" />
          <span className="flex-1 text-sm text-slate-700">
            Catálogo en el celular
            <span className="block text-xs text-slate-500">
              {catalog ? `${catalog.products.length} productos · ${formatDateTime(new Date(catalog.downloadedAt).toISOString(), settings.timezone)}` : "Sin descargar"}
            </span>
          </span>
          <Button variant="secondary" size="sm" loading={loading} onClick={() => void refresh()}>
            Actualizar
          </Button>
        </div>
        <Link href="/sincronizacion" className="flex items-center gap-3 px-3 py-3 active:bg-slate-50">
          <Cloud className="h-5 w-5 text-slate-500" />
          <span className="flex-1 text-sm text-slate-700">
            Sincronización
            <span className="block text-xs text-slate-500">
              {sync.online ? "Conectado" : "Sin señal"} · {sync.pending} por enviar{sync.errors ? ` · ${sync.errors} con error` : ""}
            </span>
          </span>
          <ChevronRight className="h-4 w-4 text-slate-400" />
        </Link>
      </Card>

      <InstallAppButton className={buttonClass("secondary", "lg") + " w-full"} />

      <Card className="divide-y divide-slate-100">
        <Row icon={<Smartphone className="h-5 w-5" />} label="Versión">
          RLS Tools {VERSION}
        </Row>
        <Row icon={<Cloud className="h-5 w-5" />} label="Central">
          {settings.name}
        </Row>
        {erpUrl && (
          <a href={erpUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-3 py-3 text-sm text-link">
            <ExternalLink className="h-5 w-5" /> Abrir el ERP HANA4
          </a>
        )}
      </Card>
    </div>
  );
}
