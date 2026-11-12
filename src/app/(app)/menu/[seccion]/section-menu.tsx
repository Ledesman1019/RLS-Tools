"use client";

import Link from "next/link";
import { useApp } from "@/components/app-provider";
import { tileBase } from "@/components/tile";
import { sectionsFor } from "@/lib/menu";
import { cn } from "@/lib/utils";

/** Herramientas de una sección, en los mismos mosaicos de funciones del ERP. */
export function SectionMenu({ sectionKey }: { sectionKey: string }) {
  const { profile, permissions } = useApp();
  const section = sectionsFor(profile.role, permissions).find((s) => s.key === sectionKey);
  if (!section) return <p className="mt-10 text-center text-sm text-white">Tu rol no tiene herramientas en esta sección.</p>;
  return (
    <div className="mx-auto flex max-w-[1480px] flex-wrap justify-center gap-2.5 sm:pt-6">
      {section.tools.map((t) => (
        <Link key={t.href} href={t.href} className={cn(tileBase, "h-[120px] w-[calc(50%-5px)] p-3 text-left sm:w-[228px]")}>
          <div className="flex items-start gap-3">
            <t.icon className="h-9 w-9 shrink-0" strokeWidth={1.75} />
            <span className="mt-1.5 text-[15px] font-bold leading-tight [text-wrap:balance]">{t.label}</span>
          </div>
          <span className="mt-auto text-[11px] text-white/80">{t.desc}</span>
        </Link>
      ))}
    </div>
  );
}
