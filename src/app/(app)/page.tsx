"use client";

import Link from "next/link";
import { useApp } from "@/components/app-provider";
import { tileBase } from "@/components/tile";
import { sectionsFor } from "@/lib/menu";
import { cn } from "@/lib/utils";

/** Inicio: secciones de la terminal (Inventarios, Ventas, Transferencias, Recibos, Otros) según el rol, en mosaicos como el ERP. */
export default function HomePage() {
  const { profile, permissions, branch } = useApp();
  const sections = sectionsFor(profile.role, permissions);
  return (
    <div className="mx-auto max-w-[1480px] sm:pt-6">
      <p className="mb-3 px-1 text-xs font-semibold uppercase tracking-wider text-white/85 sm:text-center">{branch.name}</p>
      <div className="flex flex-wrap justify-center gap-3">
        {sections.map((s) => (
          <Link key={s.key} href={`/menu/${s.key}`} className={cn(tileBase, "h-28 w-full p-4 sm:h-40 sm:w-[300px]")}>
            <s.icon className="h-9 w-9 shrink-0 sm:h-10 sm:w-10" strokeWidth={1.75} />
            <p className="mt-auto text-[17px] font-bold leading-tight">{s.label}</p>
            <p className="mt-1 truncate text-xs text-white/75">{s.tools.map((t) => t.label).join(" · ")}</p>
            <span className="absolute right-2.5 top-2 text-[10px] font-semibold uppercase tracking-wider text-white/55">RLS</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
