import { ArrowLeftRight, ClipboardCheck, FileBarChart, RefreshCw, ScanBarcode, Search, type LucideIcon } from "lucide-react";
import { hasPermission, type Action, type Permissions } from "./types";

export type Tool = {
  code: string;
  label: string;
  desc: string;
  href: string;
  icon: LucideIcon;
  /** Permiso de Inventario del ERP que exige (null = cualquier usuario de la app) */
  needs: Action | "access" | null;
};

/** Las 6 herramientas de RLS Tools; cada rol ve solo las que su permiso de Inventario permite. */
export const TOOLS: Tool[] = [
  { code: "01", label: "Inventario con pistola", desc: "Escanea y cuenta", href: "/escaneo", icon: ScanBarcode, needs: "create" },
  { code: "02", label: "Inventario físico", desc: "Sesiones por zona", href: "/inventario", icon: ClipboardCheck, needs: "access" },
  { code: "03", label: "Consulta rápida", desc: "Stock, precio y ubicación", href: "/consulta", icon: Search, needs: "access" },
  { code: "04", label: "Movimientos de almacén", desc: "Entradas, salidas y ubicación", href: "/movimientos", icon: ArrowLeftRight, needs: "edit" },
  { code: "05", label: "Reportes y diferencias", desc: "Faltantes y sobrantes", href: "/reportes", icon: FileBarChart, needs: "view" },
  { code: "06", label: "Sincronización con HANA4", desc: "Pendientes y errores", href: "/sincronizacion", icon: RefreshCw, needs: null },
];

export function toolsFor(role: string, permissions: Permissions) {
  return TOOLS.filter((t) => t.needs === null || hasPermission(role, permissions, "inventario", t.needs));
}

export function toolFor(pathname: string) {
  return TOOLS.find((t) => pathname === t.href || pathname.startsWith(`${t.href}/`));
}
