import type { Metadata } from "next";
import { SaleTool } from "../sale-tool";

export const metadata: Metadata = { title: "Nueva venta" };

export default function Page() {
  return <SaleTool mode="venta" />;
}
