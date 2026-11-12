"use client";

import Link from "next/link";
import { useApp } from "@/components/app-provider";
import { BrandLogo } from "@/components/brand";
import { toolsFor } from "@/lib/menu";

/** Inicio: las herramientas que permite el rol, en mosaicos grandes para el pulgar. */
export default function HomePage() {
  const { profile, permissions, branch } = useApp();
  const tools = toolsFor(profile.role, permissions);
  return (
    <div className="px-3 pb-6 pt-[max(1rem,env(safe-area-inset-top))] text-white">
      <div className="mb-5 flex items-end justify-between gap-3">
        <BrandLogo className="w-44 drop-shadow-[0_6px_18px_rgb(0_0_0/0.35)]" />
        <p className="truncate pb-1 text-right text-xs font-semibold text-white/85">{branch.name}</p>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {tools.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="desk-tile flex aspect-[1/0.9] flex-col rounded-[3px] border-[1.5px] border-white/75 bg-white/[0.07] p-3 active:scale-[0.98] active:bg-white/20"
          >
            <div className="flex items-start justify-between">
              <t.icon className="h-9 w-9" strokeWidth={1.75} />
              <span className="font-mono text-xs font-bold text-white/70">{t.code}</span>
            </div>
            <p className="mt-auto text-[15px] font-bold leading-tight">{t.label}</p>
            <p className="mt-0.5 text-[11px] text-white/75">{t.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
