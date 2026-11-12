"use client";

import Link from "next/link";
import { useApp } from "@/components/app-provider";
import { sectionsFor } from "@/lib/menu";

/** Herramientas de una sección en mosaicos de dos columnas. */
export function SectionMenu({ sectionKey }: { sectionKey: string }) {
  const { profile, permissions } = useApp();
  const section = sectionsFor(profile.role, permissions).find((s) => s.key === sectionKey);
  if (!section) return <p className="mt-10 text-center text-sm text-white">Tu rol no tiene herramientas en esta sección.</p>;
  return (
    <div className="grid grid-cols-2 gap-3">
      {section.tools.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-white to-slate-100 px-2 py-3 text-center shadow-[0_4px_12px_rgb(0_0_0/0.18)] ring-1 ring-white/70 active:scale-[0.98]"
        >
          <t.icon className={`h-10 w-10 ${t.tone}`} strokeWidth={1.6} />
          <span className="text-[13px] font-semibold leading-tight text-slate-700">{t.label}</span>
          <span className="text-[11px] leading-tight text-slate-500">{t.desc}</span>
        </Link>
      ))}
    </div>
  );
}
