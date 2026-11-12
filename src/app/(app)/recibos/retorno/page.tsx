import type { Metadata } from "next";
import { ReturnTool } from "./return-tool";

export const metadata: Metadata = { title: "Retorno a proveedor" };

export default function Page() {
  return <ReturnTool />;
}
