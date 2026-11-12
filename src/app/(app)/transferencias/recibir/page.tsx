import type { Metadata } from "next";
import { ReceiveList } from "./receive-list";

export const metadata: Metadata = { title: "Recibir transferencia" };

export default function Page() {
  return <ReceiveList />;
}
