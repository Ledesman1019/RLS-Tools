import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Los componentes de UI son genéricos: no conocen las herramientas ni la base de datos
    files: ["src/components/ui.tsx", "src/components/dialog.tsx", "src/components/scanner.tsx"],
    rules: { "no-restricted-imports": ["error", { patterns: [{ group: ["@/app/**", "@/lib/offline/**", "@/lib/supabase/**"], message: "La UI genérica no accede a datos." }] }] },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
