import type { Metadata } from "next";
import { StoresTool } from "./stores-tool";

export const metadata: Metadata = { title: "Tiendas" };

export default function Page() {
  return <StoresTool />;
}
