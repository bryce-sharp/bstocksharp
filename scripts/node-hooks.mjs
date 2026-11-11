// Lets plain Node import the app's TypeScript modules, for checks and one-off
// scripts that exercise real app code (lib/plaid, lib/finance, queries) without
// the Next.js server. Resolves "@/..." aliases and extensionless imports,
// stubs "server-only", maps "next/<subpath>" to its .js file, and compiles the
// app's .tsx files (Node strips types from .ts but cannot read JSX).
//
//   node --env-file=.env.local --import ./scripts/node-hooks.mjs path/to/check.mts
//
// .env.local points at the Neon dev branch, so anything run this way touches
// dev data only.

import { registerHooks } from "node:module";
import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import ts from "typescript";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const ROOT_URL = pathToFileURL(path.join(ROOT, "package.json")).href;

function withExtension(base) {
  if (existsSync(base) && statSync(base).isFile()) return base;
  for (const candidate of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

const isBare = (s) => !/^(\.|\/|node:|data:|file:|@\/)/.test(s);

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: "data:text/javascript,export {}", shortCircuit: true };
    const parent = context.parentURL?.startsWith("file://") ? fileURLToPath(context.parentURL) : null;
    let base = null;
    if (specifier.startsWith("@/")) base = path.join(ROOT, specifier.slice(2));
    else if ((specifier.startsWith("./") || specifier.startsWith("../")) && parent?.startsWith(ROOT) && !parent.includes("/node_modules/")) {
      base = path.resolve(path.dirname(parent), specifier);
    }
    if (base) {
      const file = withExtension(base);
      if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
    }
    // Checks kept outside the project still resolve its packages.
    const ctx = isBare(specifier) && parent && !parent.startsWith(ROOT) ? { ...context, parentURL: ROOT_URL } : context;
    if (/^next\/[a-z-]+$/.test(specifier)) return nextResolve(`${specifier}.js`, ctx);
    return nextResolve(specifier, ctx);
  },
  // The app's .ts files are ES modules; saying so skips Node's reparse warning.
  load(url, context, nextLoad) {
    if (url.startsWith("file://") && url.endsWith(".ts") && !url.includes("/node_modules/")) {
      return nextLoad(url, { ...context, format: "module-typescript" });
    }
    if (url.startsWith("file://") && url.endsWith(".tsx") && !url.includes("/node_modules/")) {
      const fileName = fileURLToPath(url);
      const { outputText } = ts.transpileModule(readFileSync(fileName, "utf8"), {
        fileName,
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
      });
      return { format: "module", source: outputText, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});
