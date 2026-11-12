import type { Metadata } from "next";
import { SyncTool } from "./sync-tool";

export const metadata: Metadata = { title: "Sincronización con HANA4" };

export default function SyncPage() {
  return <SyncTool />;
}
