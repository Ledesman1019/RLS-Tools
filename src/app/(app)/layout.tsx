import { Suspense } from "react";
import { AppProvider } from "@/components/app-provider";
import { Shell } from "@/components/shell";
import { getContext } from "@/lib/auth";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<div className="desk-bg min-h-dvh" />}>
      <Authenticated>{children}</Authenticated>
    </Suspense>
  );
}

async function Authenticated({ children }: { children: React.ReactNode }) {
  const ctx = await getContext();
  const value = {
    profile: ctx.profile,
    roleName: ctx.roleName,
    permissions: ctx.permissions,
    settings: ctx.settings,
    branches: ctx.branches,
    branch: ctx.branch,
    erpUrl: process.env.NEXT_PUBLIC_ERP_URL ?? "https://hana-4.vercel.app",
  };
  return (
    <AppProvider value={value}>
      <Shell>{children}</Shell>
    </AppProvider>
  );
}
