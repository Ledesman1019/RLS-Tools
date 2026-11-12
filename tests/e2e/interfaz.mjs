// Flujo real en el navegador (celular emulado) con un almacenero temporal:
// abre un inventario, escanea un producto, verifica que la cola lo envía al ERP
// sin duplicar, lo anula (no toca el stock) y limpia todo al terminar.
// Uso: node tests/e2e/interfaz.mjs http://localhost:3200   (necesita Chrome o Edge)
import { createRequire } from "node:module";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";

const root = process.cwd();
const base = (process.argv[2] ?? process.env.BASE_URL ?? "http://localhost:3200").replace(/\/$/, "");
const require = createRequire(join(root, "package.json"));
const { createClient } = require("@supabase/supabase-js");
const { createServerClient } = require("@supabase/ssr");
const readEnv = (f) => (existsSync(f) ? Object.fromEntries(readFileSync(f, "utf8").split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()])) : {});
const env = { ...readEnv(join(root, "..", "erp", ".env.local")), ...readEnv(join(root, ".env.local")), ...process.env };
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const browserPath = [process.env.BROWSER_PATH, "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium"].filter(Boolean).find((p) => existsSync(p));

let failed = 0;
const report = (ok, name, extra = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} ${extra}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const email = `qa-temp-${randomBytes(4).toString("hex")}@hana4.test`;
const password = randomBytes(18).toString("base64url");
const { data: branch } = await admin.from("branches").select("id").eq("active", true).order("code").limit(1).single();
const { data: created } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
const userId = created.user.id;
const { data: product } = await admin.from("products").select("id, name, barcode").eq("active", true).not("barcode", "is", null).order("sku").limit(1).single();
const name = `QA conteo ${randomBytes(2).toString("hex")}`;
const profileDir = mkdtempSync(join(tmpdir(), "rls-e2e-"));
let browser;

try {
  await admin.from("profiles").update({ role: "almacenero", branch_id: branch.id, active: true, full_name: "QA Temporal almacenero" }).eq("id", userId);
  const jar = new Map();
  const client = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: { getAll: () => [...jar].map(([n, v]) => ({ name: n, value: v })), setAll: (l) => l.forEach(({ name: n, value }) => jar.set(n, value)) },
  });
  await client.auth.signInWithPassword({ email, password });

  const port = 9600 + Math.floor(Math.random() * 300);
  browser = spawn(browserPath, ["--headless=new", "--disable-gpu", `--remote-debugging-port=${port}`, `--user-data-dir=${profileDir}`, "about:blank"]);
  let ws;
  for (let i = 0; i < 60 && !ws; i++) {
    await sleep(250);
    try {
      ws = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === "page")?.webSocketDebuggerUrl;
    } catch {}
  }
  const sock = new WebSocket(ws);
  await new Promise((r) => sock.addEventListener("open", r, { once: true }));
  let seq = 0;
  const pending = new Map();
  sock.addEventListener("message", (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) pending.get(msg.id)(msg);
  });
  const send = (method, params = {}) => new Promise((r) => { const n = ++seq; pending.set(n, r); sock.send(JSON.stringify({ id: n, method, params })); });
  const evaluate = async (expr) => (await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;
  const waitFor = async (expr, ms = 20000) => {
    for (let t = 0; t < ms; t += 250) {
      if (await evaluate(expr)) return true;
      await sleep(250);
    }
    return false;
  };
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  const url = new URL(base);
  for (const [n, value] of jar) await send("Network.setCookie", { name: n, value, domain: url.hostname, path: "/", secure: url.protocol === "https:" });
  await send("Page.enable");

  // 1. Abrir inventario
  await send("Page.navigate", { url: `${base}/inventario?nuevo=1` });
  report(await waitFor(`!!document.querySelector('dialog[open] input[name="name"]')`), "abre el formulario de nuevo inventario");
  await evaluate(`(() => { const f = document.querySelector("dialog[open] form"); f.elements.namedItem("name").value = ${JSON.stringify(name)}; f.requestSubmit(); })()`);
  report(await waitFor(`location.pathname === "/escaneo" && location.search.includes("sesion=")`), "abre el inventario y pasa al escaneo");
  const session = (await admin.from("count_sessions").select("id, number").eq("name", name).single()).data;
  report(Boolean(session?.number?.startsWith("IF")), "el inventario existe en el ERP", session?.number);

  // 2. Escanear (como la pistola: escribe el código y Enter)
  report(await waitFor(`!!document.querySelector('input[aria-label="Código de barras, QR o SKU"]')`), "el catálogo se descargó y el lector está listo");
  const scan = (code) =>
    evaluate(`(() => { const i = document.querySelector('input[aria-label="Código de barras, QR o SKU"]');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(i, ${JSON.stringify(code)});
      i.dispatchEvent(new Event("input", { bubbles: true }));
      i.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); })()`);
  await scan(product.barcode);
  await sleep(300);
  await scan(product.barcode);
  await sleep(300);
  await scan("0000000099999");
  report(await waitFor(`document.body.textContent.includes(${JSON.stringify(product.name)})`), "reconoce el producto escaneado", product.name);
  report(await waitFor(`document.body.textContent.includes("no está registrado")`), "marca un código que no existe en el ERP");

  // 3. La cola lo envía al ERP
  let counted = 0;
  for (let i = 0; i < 40 && counted !== 2; i++) {
    await sleep(500);
    counted = Number((await admin.from("count_lines").select("counted").eq("session_id", session.id).eq("product_id", product.id).maybeSingle()).data?.counted ?? 0);
  }
  report(counted === 2, "los 2 escaneos llegan al ERP (sin duplicar)", `contado=${counted}`);
  report(Number((await admin.from("count_unknown_codes").select("quantity").eq("session_id", session.id).maybeSingle()).data?.quantity ?? 0) === 1, "el código no registrado se reporta en el ERP");
  report(Number((await admin.from("mobile_operations").select("id", { count: "exact", head: true }).eq("user_id", userId)).count) >= 4, "cada operación quedó en la bitácora móvil");

  // 4. Sincronización al día y anulación (no mueve stock)
  await send("Page.navigate", { url: `${base}/sincronizacion` });
  report(await waitFor(`document.body.textContent.includes("Conectado al ERP HANA4") && document.body.textContent.includes("Enviado desde este celular")`), "pantalla de sincronización");
  await send("Page.navigate", { url: `${base}/inventario/${session.id}` });
  report(await waitFor(`document.body.textContent.includes(${JSON.stringify(session.number)})`), "detalle del inventario");
  await evaluate(`[...document.querySelectorAll("button")].find(b => b.textContent.includes("Anular inventario"))?.click()`);
  await waitFor(`!!document.querySelector("dialog[open] input")`);
  await evaluate(`(() => { const i = document.querySelector("dialog[open] input"); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(i, "Prueba automática"); i.dispatchEvent(new Event("input", { bubbles: true })); })()`);
  await sleep(300);
  await evaluate(`[...document.querySelectorAll("dialog[open] button")].find(b => b.textContent.trim() === "Anular")?.click()`);
  let status = "";
  for (let i = 0; i < 40 && status !== "anulada"; i++) {
    await sleep(500);
    status = (await admin.from("count_sessions").select("status").eq("id", session.id).single()).data?.status;
  }
  report(status === "anulada", "anula el inventario desde el celular", status);
} catch (e) {
  failed++;
  console.log("ERROR", e);
} finally {
  browser?.kill();
  await admin.from("count_sessions").delete().eq("name", name);
  await admin.from("mobile_operations").delete().eq("user_id", userId);
  await admin.auth.admin.deleteUser(userId);
  await sleep(500);
  try { rmSync(profileDir, { recursive: true, force: true }); } catch {}
  console.log("usuario temporal y datos de prueba eliminados");
}
console.log(failed ? `\n${failed} PRUEBAS FALLARON` : "\nINTERFAZ OK");
process.exit(failed ? 1 : 0);
