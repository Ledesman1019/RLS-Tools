import type { Metadata } from "next";
import { SectionMenu } from "./section-menu";

export const metadata: Metadata = { title: "Menú" };

export default async function SectionPage({ params }: PageProps<"/menu/[seccion]">) {
  const { seccion } = await params;
  return <SectionMenu sectionKey={seccion} />;
}
