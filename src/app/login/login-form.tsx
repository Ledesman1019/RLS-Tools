"use client";

import { useActionState } from "react";
import { Building2, Check, KeyRound, Loader2, UserRound, X } from "lucide-react";
import { login } from "@/app/actions";
import { exitApp } from "@/lib/exit";

const label = "mb-1 block text-xs font-medium text-slate-700";
const box =
  "flex h-11 items-center overflow-hidden rounded-[3px] border border-slate-400/80 bg-white shadow-[inset_0_1px_2px_rgb(0_0_0/0.08)] focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/25";
const icon = "ml-3 h-[18px] w-[18px] shrink-0 text-slate-500";
const input = "h-full min-w-0 flex-1 bg-transparent px-2.5 text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none";
const classicButton =
  "flex h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-[3px] border border-slate-400/80 bg-gradient-to-b from-white to-slate-200 text-sm font-semibold text-slate-800 shadow-sm active:translate-y-px disabled:cursor-wait disabled:opacity-70";

/** Ventana «Información de usuario»: mismas credenciales que el ERP HANA4. */
export function LoginForm({ central }: { central: string }) {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="space-y-3">
      <div>
        <label htmlFor="email" className={label}>
          Usuario:
        </label>
        <div className={box}>
          <UserRound className={icon} />
          <input id="email" name="email" type="email" inputMode="email" autoComplete="username" required placeholder="correo@empresa.com" className={input} />
        </div>
      </div>
      <div>
        <label htmlFor="password" className={label}>
          Clave:
        </label>
        <div className={box}>
          <KeyRound className={icon} />
          <input id="password" name="password" type="password" autoComplete="current-password" required className={input} />
        </div>
      </div>
      <div>
        <span className={label}>Central:</span>
        <div className={`${box} bg-slate-50`}>
          <Building2 className={icon} />
          <span className="px-2.5 text-sm font-semibold text-slate-700">{central}</span>
        </div>
      </div>
      {state?.error && (
        <p role="alert" className="rounded-[3px] border border-red-300 bg-red-50 px-3 py-2 text-[13px] font-medium text-red-700">
          {state.error}
        </p>
      )}
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={pending} className={classicButton}>
          {pending ? <Loader2 className="h-[18px] w-[18px] animate-spin text-brand-600" /> : <Check className="h-[18px] w-[18px] text-emerald-600" strokeWidth={3} />}
          {pending ? "Conectando…" : "Conectar"}
        </button>
        <button type="button" onClick={exitApp} className={classicButton}>
          <X className="h-[18px] w-[18px] text-red-600" strokeWidth={3} />
          Salir
        </button>
      </div>
    </form>
  );
}
