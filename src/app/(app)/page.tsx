"use client";

import Link from "next/link";
import { useApp } from "@/components/app-provider";
import { sectionsFor } from "@/lib/menu";

/** Inicio: secciones de la terminal (Inventarios, Ventas, Transferencias, Recibos, Otros) según el rol. */
export default function HomePage() {
  const { profile, permissions, branch } = useApp();
  const sections = sectionsFor(profile.role, permissions);
  return (
    <div className="space-y-3">
      <p className="px-1 text-xs font-semibold uppercase tracking-wider text-white/80">{branch.name}</p>
      {sections.map((s) => (
        <Link
          key={s.key}
          href={`/menu/${s.key}`}
          className="flex h-[88px] items-center rounded-2xl bg-gradient-to-b from-white to-sky-50 px-5 shadow-[0_4px_14px_rgb(0_0_0/0.18)] ring-1 ring-white/70 active:scale-[0.99] active:from-sky-50"
        >
          <span className="flex w-16 justify-center">
            <s.icon className={`h-11 w-11 ${s.tone}`} strokeWidth={1.6} />
          </span>
          <span className="flex-1 text-center text-lg font-semibold text-slate-700">{s.label}</span>
          <span className="w-16" />
        </Link>
      ))}
    </div>
  );
}
