import type { Metadata } from "next";
import { ReceivePo } from "./receive-po";

export const metadata: Metadata = { title: "Recibir O/C" };

export default async function Page({ params }: PageProps<"/recibos/[id]">) {
  const { id } = await params;
  return <ReceivePo id={id} />;
}
