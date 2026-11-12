import { cn } from "@/lib/utils";

/** Símbolo de RLS Tools (engranaje con herramientas) sobre ficha azul marino. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#060e1f] shadow-sm ring-1 ring-white/20", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- PNG pequeño y ya optimizado */}
      <img src="/brand/mark.png" alt="" width={256} height={256} className="h-full w-full object-contain" />
    </span>
  );
}

/** Logo completo «RLS TOOLS». */
export function BrandLogo({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- PNG ya optimizado
    <img src="/brand/logo.png" alt="RLS Tools" width={720} height={278} className={cn("h-auto", className)} />
  );
}
