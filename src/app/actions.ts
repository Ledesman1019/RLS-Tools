"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { BRANCH_COOKIE, canIn, getContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string } | undefined;

const credentials = z.object({
  email: z.email("Correo inválido"),
  password: z.string().min(1, "Ingresa tu clave"),
});

/** Mismas credenciales que el ERP HANA4. */
export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = credentials.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: error.code === "invalid_credentials" ? "Usuario o clave incorrectos" : "No se pudo conectar. Revisa tu señal e inténtalo de nuevo" };
  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/** Sucursal de trabajo (solo quien supervisa varias, igual que en el ERP). */
export async function setBranch(branchId: string) {
  const ctx = await getContext();
  const allowed = canIn(ctx, "reportes", "view") || canIn(ctx, "configuracion", "view");
  if (!allowed || !ctx.branches.some((b) => b.id === branchId)) return;
  (await cookies()).set(BRANCH_COOKIE, branchId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 180 });
  revalidatePath("/", "layout");
}
