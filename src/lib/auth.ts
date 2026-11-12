import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { sectionsFor } from "./menu";
import { createClient } from "./supabase/server";
import { hasSupabaseEnv } from "./supabase/env";
import { hasPermission, type Action, type Branch, type Permissions, type Profile, type Settings } from "./types";

/** Versión del esquema del ERP que necesita RLS Tools (migraciones 0010 y 0011 del ERP). */
export const REQUIRED_SCHEMA = 11;
export const BRANCH_COOKIE = "rls_branch";

export type AppContext = {
  userId: string;
  profile: Profile;
  roleName: string;
  permissions: Permissions;
  settings: Settings;
  branches: Branch[];
  branch: Branch;
};

type Loaded = ({ status: "ok" } & AppContext) | { status: "setup" | "anonymous" | "inactive" | "denied" };

/**
 * Perfil, rol y permisos desde el ERP en un solo viaje (función app_context).
 * RLS Tools es para quien trabaja el inventario: sin permiso de Inventario no entra.
 */
export const loadContext = cache(async (): Promise<Loaded> => {
  await connection();
  if (!hasSupabaseEnv) return { status: "setup" };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return { status: "anonymous" };

  const { data, error } = await supabase.rpc("app_context");
  if (error || !data) return { status: "setup" };
  const ctx = data as { schema?: number; profile: Profile | null; role_name: string | null; settings: Settings | null; branches: Branch[] | null; permissions: Permissions | null };
  if ((ctx.schema ?? 0) < REQUIRED_SCHEMA) return { status: "setup" };
  const { profile, settings } = ctx;
  if (!profile || !profile.active || !settings) return { status: "inactive" };
  const permissions = ctx.permissions ?? {};
  // Entra quien tenga al menos una herramienta (inventario, ventas, compras…)
  if (sectionsFor(profile.role, permissions).length === 0) return { status: "denied" };

  const branches = ctx.branches ?? [];
  let branchId = profile.branch_id;
  // Quien supervisa puede trabajar en otra sucursal (igual que en el ERP)
  if (hasPermission(profile.role, permissions, "reportes", "view") || hasPermission(profile.role, permissions, "configuracion", "view")) {
    const chosen = (await cookies()).get(BRANCH_COOKIE)?.value;
    if (chosen && branches.some((b) => b.id === chosen)) branchId = chosen;
  }
  const branch = branches.find((b) => b.id === branchId) ?? branches[0];
  if (!branch) return { status: "inactive" };
  return { status: "ok", userId, profile, roleName: ctx.role_name ?? profile.role, permissions, settings, branches, branch };
});

export async function getContext(): Promise<AppContext> {
  const ctx = await loadContext();
  if (ctx.status !== "ok") {
    if (ctx.status === "anonymous") redirect("/login");
    if (ctx.status === "setup") redirect("/actualizar");
    redirect(`/sin-acceso?motivo=${ctx.status}`);
  }
  return ctx;
}

export function canIn(ctx: Pick<AppContext, "profile" | "permissions">, module: string, action: Action | "access") {
  return hasPermission(ctx.profile.role, ctx.permissions, module, action);
}
