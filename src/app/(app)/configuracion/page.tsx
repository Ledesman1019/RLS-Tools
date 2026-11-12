import type { Metadata } from "next";
import { SettingsTool } from "./settings-tool";

export const metadata: Metadata = { title: "Configuración" };

export default function Page() {
  return <SettingsTool />;
}
