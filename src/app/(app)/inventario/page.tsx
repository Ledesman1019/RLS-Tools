import type { Metadata } from "next";
import { SessionsList } from "./sessions-list";

export const metadata: Metadata = { title: "Inventario físico" };

export default async function InventoryPage({ searchParams }: PageProps<"/inventario">) {
  return <SessionsList startNew={(await searchParams).nuevo === "1"} />;
}
