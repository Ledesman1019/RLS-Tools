import type { Metadata } from "next";
import { MovesTool } from "./moves-tool";

export const metadata: Metadata = { title: "Movimientos de almacén" };

export default function MovesPage() {
  return <MovesTool />;
}
