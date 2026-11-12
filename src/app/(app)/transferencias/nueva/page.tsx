import type { Metadata } from "next";
import { SendTool } from "./send-tool";

export const metadata: Metadata = { title: "Nueva transferencia" };

export default function Page() {
  return <SendTool />;
}
