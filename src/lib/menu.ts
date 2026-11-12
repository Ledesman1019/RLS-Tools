import {
  ArrowLeftRight,
  ArrowRightLeft,
  BadgeCheck,
  Boxes,
  ClipboardCheck,
  ClipboardList,
  FileBarChart,
  FilePlus2,
  MoreHorizontal,
  PackageCheck,
  PackageMinus,
  RefreshCw,
  ScanBarcode,
  Search,
  ShoppingCart,
  Store,
  Truck,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { hasPermission, type Action, type Permissions } from "./types";

/** Permiso del ERP: [módulo, acción]. Una herramienta exige todos los que declara. */
type Need = [module: string, action: Action | "access"];

export type Tool = { label: string; desc: string; href: string; icon: LucideIcon; tone: string; needs: Need[] };
export type Section = { key: string; label: string; icon: LucideIcon; tone: string; tools: Tool[] };

/**
 * Menú de RLS Tools por secciones (Inventarios, Ventas, Transferencias, Recibos, Otros).
 * Todo se aplica en el ERP HANA4; cada rol ve solo lo que sus permisos del ERP permiten.
 */
export const SECTIONS: Section[] = [
  {
    key: "inventarios",
    label: "Inventarios",
    icon: Boxes,
    tone: "text-amber-700",
    tools: [
      { label: "Búsqueda de Inventario", desc: "Stock, precio y ubicación", href: "/consulta", icon: Search, tone: "text-sky-600", needs: [["inventario", "access"]] },
      { label: "Inventario Físico", desc: "Sesiones por zona", href: "/inventario", icon: ClipboardCheck, tone: "text-orange-600", needs: [["inventario", "access"]] },
      { label: "Inventario con Pistola", desc: "Escanea y cuenta", href: "/escaneo", icon: ScanBarcode, tone: "text-indigo-600", needs: [["inventario", "create"]] },
      { label: "Tiendas", desc: "Stock en cada tienda", href: "/tiendas", icon: Store, tone: "text-rose-600", needs: [["inventario", "access"]] },
    ],
  },
  {
    key: "ventas",
    label: "Ventas",
    icon: ShoppingCart,
    tone: "text-emerald-600",
    tools: [
      { label: "Nueva Venta", desc: "Cobra desde el celular", href: "/ventas/nueva", icon: ShoppingCart, tone: "text-emerald-600", needs: [["ventas", "create"], ["caja", "create"]] },
      { label: "Nueva Orden", desc: "Cotización para cobrar en caja", href: "/ventas/orden", icon: FilePlus2, tone: "text-sky-600", needs: [["ventas", "create"]] },
      { label: "Autorizaciones", desc: "Aprobar solicitudes de pedido", href: "/autorizaciones", icon: BadgeCheck, tone: "text-amber-600", needs: [["compras", "edit"]] },
    ],
  },
  {
    key: "transferencias",
    label: "Transferencias",
    icon: ArrowLeftRight,
    tone: "text-sky-600",
    tools: [
      { label: "Nueva Transferencia", desc: "Enviar a otra tienda", href: "/transferencias/nueva", icon: ArrowRightLeft, tone: "text-sky-600", needs: [["inventario", "edit"]] },
      { label: "Recibir Transferencia", desc: "Mercadería en tránsito", href: "/transferencias/recibir", icon: PackageCheck, tone: "text-emerald-600", needs: [["inventario", "edit"]] },
    ],
  },
  {
    key: "recibos",
    label: "Recibos",
    icon: Truck,
    tone: "text-slate-700",
    tools: [
      { label: "Recibir O/C", desc: "Órdenes de compra por recibir", href: "/recibos", icon: ClipboardList, tone: "text-orange-600", needs: [["compras", "view"], ["inventario", "edit"]] },
      { label: "Retorno a Proveedor", desc: "Devolver mercadería", href: "/recibos/retorno", icon: Undo2, tone: "text-rose-600", needs: [["inventario", "edit"], ["compras", "view"]] },
    ],
  },
  {
    key: "otros",
    label: "Otros",
    icon: MoreHorizontal,
    tone: "text-sky-500",
    tools: [
      { label: "Movimientos de Almacén", desc: "Entradas, salidas y ubicación", href: "/movimientos", icon: PackageMinus, tone: "text-indigo-600", needs: [["inventario", "edit"]] },
      { label: "Reportes y Diferencias", desc: "Faltantes y sobrantes", href: "/reportes", icon: FileBarChart, tone: "text-emerald-600", needs: [["inventario", "view"]] },
      { label: "Sincronización con HANA4", desc: "Pendientes y errores", href: "/sincronizacion", icon: RefreshCw, tone: "text-sky-600", needs: [] },
    ],
  },
];

const allowed = (role: string, permissions: Permissions) => (t: Tool) => t.needs.every(([m, a]) => hasPermission(role, permissions, m, a));

/** Secciones con las herramientas que el rol puede usar (se ocultan las vacías). */
export function sectionsFor(role: string, permissions: Permissions): Section[] {
  return SECTIONS.map((s) => ({ ...s, tools: s.tools.filter(allowed(role, permissions)) })).filter((s) => s.tools.some((t) => t.needs.length > 0));
}

/** Herramienta y sección de una ruta (para «Atrás», el título y el control de acceso). */
export function locate(pathname: string): { section: Section; tool: Tool | null } | null {
  let best: { section: Section; tool: Tool; len: number } | null = null;
  for (const section of SECTIONS) {
    for (const tool of section.tools) {
      if ((pathname === tool.href || pathname.startsWith(`${tool.href}/`)) && (!best || tool.href.length > best.len)) best = { section, tool, len: tool.href.length };
    }
  }
  if (best) return { section: best.section, tool: best.tool };
  const m = pathname.match(/^\/menu\/([a-z]+)$/);
  const section = m && SECTIONS.find((s) => s.key === m[1]);
  return section ? { section, tool: null } : null;
}

export function canUse(tool: Tool, role: string, permissions: Permissions) {
  return allowed(role, permissions)(tool);
}
