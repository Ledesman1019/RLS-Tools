"use client";

import { useActionState } from "react";
import { Check, Database, KeyRound, Loader2, UserRound, X } from "lucide-react";
import { login } from "@/app/actions";

const label = "mb-1 block text-[13px] font-medium text-slate-700";
const box =
  "flex h-12 items-center overflow-hidden rounded-[3px] border border-slate-400/80 bg-white shadow-[inset_0_1px_2px_rgb(0_0_0/0.08)] focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/25";
const icon = "ml-3 h-5 w-5 shrink-0 text-slate-500";
const input = "h-full min-w-0 flex-1 bg-transparent px-3 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none";
const classicButton =
  "flex h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-[3px] border border-slate-400/80 bg-gradient-to-b from-white to-slate-200 text-[15px] font-semibold text-slate-800 shadow-sm active:translate-y-px disabled:cursor-wait disabled:opacity-70";

/** Ventana «Información de usuario»: mismas credenciales que el ERP. */
export function LoginForm({ database }: { database: string }) {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="space-y-3.5">
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
        <label htmlFor="db" className={label}>
          Base de Datos:
        </label>
        <div className={box}>
          <Database className={icon} />
          <select id="db" disabled className="h-full min-w-0 flex-1 appearance-none bg-transparent px-3 font-mono text-[13px] text-slate-700 opacity-100">
            <option>{database}</option>
          </select>
        </div>
      </div>
      {state?.error && (
        <p role="alert" className="rounded-[3px] border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {state.error}
        </p>
      )}
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={pending} className={classicButton}>
          {pending ? <Loader2 className="h-5 w-5 animate-spin text-brand-600" /> : <Check className="h-5 w-5 text-emerald-600" strokeWidth={3} />}
          {pending ? "Conectando…" : "Conectar"}
        </button>
        <button type="reset" className={classicButton}>
          <X className="h-5 w-5 text-red-600" strokeWidth={3} />
          Salir
        </button>
      </div>
    </form>
  );
}
