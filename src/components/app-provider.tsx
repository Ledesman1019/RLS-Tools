"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { hasPermission, type Action, type Branch, type Permissions, type Profile, type Settings } from "@/lib/types";
import { formatMoney } from "@/lib/utils";

type AppData = { profile: Profile; roleName: string; permissions: Permissions; settings: Settings; branches: Branch[]; branch: Branch; erpUrl: string };
type AppValue = AppData & {
  /** Solo para mostrar u ocultar controles: el ERP vuelve a verificar cada operación. */
  can: (module: string, action: Action | "access") => boolean;
  money: (n: number | string | null | undefined) => string;
};

const AppContext = createContext<AppValue | null>(null);

export function AppProvider({ value, children }: { value: AppData; children: ReactNode }) {
  const full = useMemo<AppValue>(
    () => ({
      ...value,
      can: (module, action) => hasPermission(value.profile.role, value.permissions, module, action),
      money: (n) => formatMoney(n, value.settings.currency_symbol),
    }),
    [value],
  );
  return <AppContext value={full}>{children}</AppContext>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp debe usarse dentro de AppProvider");
  return ctx;
}
