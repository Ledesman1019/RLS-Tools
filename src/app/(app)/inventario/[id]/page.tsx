import type { Metadata } from "next";
import { SessionDetail } from "./session-detail";

export const metadata: Metadata = { title: "Inventario" };

export default async function SessionPage({ params }: PageProps<"/inventario/[id]">) {
  const { id } = await params;
  return <SessionDetail key={id} id={id} />;
}
