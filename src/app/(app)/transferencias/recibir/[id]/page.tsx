import type { Metadata } from "next";
import { ReceiveTransfer } from "./receive-transfer";

export const metadata: Metadata = { title: "Recibir transferencia" };

export default async function Page({ params }: PageProps<"/transferencias/recibir/[id]">) {
  const { id } = await params;
  return <ReceiveTransfer id={id} />;
}
