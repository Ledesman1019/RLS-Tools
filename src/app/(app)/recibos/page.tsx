import type { Metadata } from "next";
import { PoSearch } from "./po-search";

export const metadata: Metadata = { title: "Búsqueda O/C" };

export default function Page() {
  return <PoSearch />;
}
