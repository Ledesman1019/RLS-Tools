// Recorrido autenticado de RLS Tools con usuarios temporales de varios roles.
// Crea los usuarios con la clave de servicio, entra con su sesión y los borra al final.
// Uso: npm run test:e2e -- http://localhost:3200
// La clave de servicio se toma de SUPABASE_SERVICE_ROLE_KEY o del .env.local del ERP (../erp).
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

const root = process.cwd();
const base = (process.argv[2] ?? process.env.BASE_URL ?? "http://localhost:3200").replace(/\/$/, "");
const require = createRequire(join(root, "package.json"));
const { createClient } = require("@supabase/supabase-js");
const { createServerClient } = require("@supabase/ssr");
const readEnv = (file) =>
  existsSync(file) ? Object.fromEntries(readFileSync(file, "utf8").split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()])) : {};
const env = { ...readEnv(join(root, "..", "erp", ".env.local")), ...readEnv(join(root, ".env.local")), ...process.env };
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(URL_, env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

let failed = 0;
const created = [];
const report = (ok, name, extra = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} ${extra}`);
};

async function login(role) {
  const email = `qa-temp-${randomBytes(4).toString("hex")}@hana4.test`;
  const password = randomBytes(18).toString("base64url");
  const { data: branch } = await admin.from("branches").select("id").eq("active", true).order("code").limit(1).single();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `QA Temporal ${role}` } });
  if (error) throw new Error(error.message);
  created.push(data.user.id);
  await admin.from("profiles").update({ role, branch_id: branch.id, active: true, full_name: `QA Temporal ${role}` }).eq("id", data.user.id);
  const jar = new Map();
  const client = createServerClient(URL_, KEY, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => jar.set(name, value)) } });
  await client.auth.signInWithPassword({ email, password });
  return [...jar].map(([n, v]) => `${n}=${v}`).join("; ");
}

async function get(cookie, path) {
  const res = await fetch(base + path, { headers: { cookie }, redirect: "manual" });
  return { status: res.status, location: res.headers.get("location") ?? "", body: await res.text() };
}

async function page(cookie, path, expected, label = path) {
  const { status, body, location } = await get(cookie, path);
  const redirected = status === 307 || body.includes("NEXT_REDIRECT");
  const missing = expected.filter((t) => !body.includes(t));
  report(status === 200 && !redirected && missing.length === 0, label, missing.length ? `falta=${JSON.stringify(missing)}` : redirected ? `→ ${location || "redirige"}` : "");
  return body;
}

try {
  const { data: schema } = await admin.rpc("schema_version");
  console.log(`— Base del ERP en el esquema ${schema} —`);
  const a = await login("almacenero");

  if (Number(schema) < 11) {
    const home = await get(a, "/");
    report(home.body.includes("NEXT_REDIRECT") && home.body.includes("/actualizar"), "sin las migraciones 0010 y 0011 lleva a «Falta actualizar»");
    const up = await get(a, "/actualizar");
    report(up.status === 200 && up.body.includes("0011_transferencias_retornos.sql"), "/actualizar explica qué migración falta");
  } else {
    console.log("— Almacenero —");
    const home = await page(a, "/", ["Inventarios", "Transferencias", "Recibos", "Otros", "Configuración", "Cerrar Sesión"]);
    report(!home.includes(">Ventas<"), "almacenero no ve la sección Ventas");
    await page(a, "/menu/inventarios", ["Búsqueda de Inventario", "Inventario Físico", "Inventario con Pistola", "Tiendas"]);
    await page(a, "/menu/transferencias", ["Nueva Transferencia", "Recibir Transferencia"]);
    await page(a, "/menu/recibos", ["Recibir O/C", "Retorno a Proveedor"]);
    for (const [path, title] of [
      ["/escaneo", "Inventario con Pistola"],
      ["/inventario", "Inventario Físico"],
      ["/consulta", "Búsqueda de Inventario"],
      ["/tiendas", "Tiendas"],
      ["/transferencias/nueva", "Nueva Transferencia"],
      ["/transferencias/recibir", "Recibir Transferencia"],
      ["/recibos", "Recibir O/C"],
      ["/recibos/retorno", "Retorno a Proveedor"],
      ["/movimientos", "Movimientos de Almacén"],
      ["/reportes", "Reportes y Diferencias"],
      ["/sincronizacion", "Sincronización con HANA4"],
      ["/configuracion", "Configuración"],
    ])
      await page(a, path, [title]);
    await page(a, "/ventas/nueva", ["Tu rol no tiene esta herramienta"], "almacenero no puede vender");

    console.log("— Comprador (autoriza pedidos, consulta inventario) —");
    const b = await login("comprador");
    const bh = await page(b, "/", ["Inventarios", "Ventas"]);
    report(!bh.includes("Transferencias"), "comprador no transfiere mercadería");
    await page(b, "/menu/ventas", ["Autorizaciones"]);
    await page(b, "/autorizaciones", ["Autorizaciones"]);
    await page(b, "/movimientos", ["Tu rol no tiene esta herramienta"], "comprador ve aviso en Movimientos");

    console.log("— Cajero (vende desde el celular) —");
    const c = await login("cajero");
    const ch = await page(c, "/", ["Ventas"]);
    report(!ch.includes("Inventarios") && !ch.includes("Recibos"), "cajero solo ve Ventas");
    await page(c, "/menu/ventas", ["Nueva Venta", "Nueva Orden"]);
    await page(c, "/ventas/nueva", ["Nueva Venta", "Cobrar"]);

    console.log("— Vendedor (órdenes que cobra caja) —");
    const v = await login("vendedor");
    await page(v, "/menu/ventas", ["Nueva Orden"]);
    await page(v, "/ventas/orden", ["Nueva Orden", "Registrar orden"]);
    await page(v, "/ventas/nueva", ["Tu rol no tiene esta herramienta"], "vendedor no cobra (sin caja)");

    console.log("— Contador (sin herramientas) —");
    const k = await login("contador");
    const kh = await get(k, "/");
    report(kh.body.includes("/sin-acceso"), "contador no entra a RLS Tools");
  }

  const lp = await fetch(base + "/login");
  report(lp.status === 200 && (await lp.text()).includes("Información de Usuario"), "/login");
  const mf = await (await fetch(base + "/manifest.webmanifest")).json().catch(() => null);
  report(mf?.short_name === "RLS Tools" && mf?.orientation === "portrait", "manifiesto PWA para celular");
  const sw = await fetch(base + "/sw.js");
  report(sw.status === 200 && (await sw.text()).includes("rls-tools-v") && (await (await fetch(base + "/sw.js")).text()).includes("notificationclick"), "service worker de RLS Tools");
} catch (e) {
  failed++;
  console.log("ERROR", e.message);
} finally {
  for (const id of created) await admin.auth.admin.deleteUser(id);
  console.log(`usuarios temporales eliminados: ${created.length}`);
}
console.log(failed ? `\n${failed} VERIFICACIONES FALLARON` : "\nTODO FUNCIONA");
process.exit(failed ? 1 : 0);
