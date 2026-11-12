import type { Metadata } from "next";
import { ReportsTool } from "./reports-tool";

export const metadata: Metadata = { title: "Reportes y diferencias" };

export default function ReportsPage() {
  return <ReportsTool />;
}
