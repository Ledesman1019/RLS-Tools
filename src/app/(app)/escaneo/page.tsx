import type { Metadata } from "next";
import { ScanTool } from "./scan-tool";

export const metadata: Metadata = { title: "Inventario con pistola" };

export default async function ScanPage({ searchParams }: PageProps<"/escaneo">) {
  const sesion = (await searchParams).sesion;
  return <ScanTool initialSession={typeof sesion === "string" ? sesion : undefined} />;
}
