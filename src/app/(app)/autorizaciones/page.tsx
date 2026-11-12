import type { Metadata } from "next";
import { ApprovalsTool } from "./approvals-tool";

export const metadata: Metadata = { title: "Autorizaciones" };

export default function Page() {
  return <ApprovalsTool />;
}
