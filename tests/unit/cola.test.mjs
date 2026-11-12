// Reglas de la cola de sincronización offline (src/lib/offline/sync-logic.ts).
// Uso: npm test
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const ts = createRequire(join(root, "package.json"))("typescript");
const out = mkdtempSync(join(tmpdir(), "rls-cola-"));
const code = ts.transpileModule(readFileSync(join(root, "src/lib/offline/sync-logic.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
writeFileSync(join(out, "logic.mjs"), code);
const { pendingInOrder, classify, backoffMs, summarize } = await import(pathToFileURL(join(out, "logic.mjs")).href);

let failed = 0;
const ok = (name, cond, extra = "") => {
  if (!cond) failed++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name} ${extra}`);
};
const op = (id, createdAt, status = "pendiente") => ({ id, rpc: "rls_count", args: {}, kind: "conteo", summary: id, branchId: "b", createdAt, attempts: 0, status });

const ops = [op("c", 30), op("a", 10), op("x", 5, "error"), op("b", 20)];
ok("envía en el orden en que se escaneó", pendingInOrder(ops).map((o) => o.id).join() === "a,b,c");
ok("las rechazadas esperan revisión (no se reenvían solas)", !pendingInOrder(ops).some((o) => o.id === "x"));
ok("resumen de pendientes y errores", JSON.stringify(summarize(ops)) === JSON.stringify({ pending: 3, errors: 1 }));

ok("sin error → aplicada", classify(null, true).kind === "ok");
ok("sin señal → se reintenta", classify({ message: "TypeError: Failed to fetch" }, true).kind === "offline");
ok("celular sin red → se reintenta", classify({ message: "cualquier cosa" }, false).kind === "offline");
ok("servidor caído (5xx) → se reintenta", classify({ message: "Bad gateway", status: 502 }, true).kind === "offline");
ok("sesión vencida → se reintenta al volver a entrar", classify({ message: "JWT expired", status: 401 }, true).kind === "offline");
const rej = classify({ message: "El inventario IF001-00000003 ya está cerrada", code: "P0001", status: 400 }, true);
ok("regla de negocio del ERP → rechazada con su motivo", rej.kind === "rejected" && rej.message.includes("ya está cerrada"));

ok("espera creciente entre reintentos", backoffMs(1) === 2000 && backoffMs(2) === 4000 && backoffMs(3) === 8000);
ok("la espera no supera 1 minuto", backoffMs(20) === 60000);

console.log(failed ? `\n${failed} PRUEBAS FALLARON` : "\nCOLA OK");
process.exit(failed ? 1 : 0);
