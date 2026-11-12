/** Módulos de permisos del ERP que usa RLS Tools. */
export type Action = "view" | "create" | "edit" | "delete";
export type ModuleKey = "inventario" | "compras" | "configuracion" | "reportes";
export type Permissions = Partial<Record<string, Partial<Record<Action, boolean>>>>;

export type Profile = { id: string; full_name: string; email: string; role: string; branch_id: string | null; active: boolean; is_super: boolean };
export type Branch = { id: string; code: string; name: string; active: boolean };
export type Settings = { name: string; currency_symbol: string; timezone: string };

/** Mismo criterio que el ERP: el administrador tiene todo; el resto, lo de su rol. */
export function hasPermission(role: string, permissions: Permissions, module: string, action: Action | "access"): boolean {
  if (role === "admin") return true;
  const p = permissions[module];
  if (!p) return false;
  return action === "access" ? Boolean(p.view || p.create) : Boolean(p[action]);
}

/** Producto del catálogo guardado en el celular (para consultar y escanear sin señal). */
export type CatalogProduct = {
  product_id: string;
  sku: string;
  barcode: string | null;
  name: string;
  unit: string;
  price: number;
  cost: number;
  quantity: number;
  min_stock: number;
  active: boolean;
  category_name: string | null;
  track_lots: boolean;
  pack_unit: string;
  pack_size: number;
  location_code: string | null;
  zone: string | null;
};

export type Location = { id: string; code: string; zone: string; description: string };
