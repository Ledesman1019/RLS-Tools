import type { Metadata } from "next";
import { LookupTool } from "./lookup-tool";

export const metadata: Metadata = { title: "Consulta rápida" };

export default function LookupPage() {
  return <LookupTool />;
}
