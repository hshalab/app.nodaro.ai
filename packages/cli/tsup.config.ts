import { defineConfig } from "tsup"
import { readFileSync } from "node:fs"

// Injected into the `X-Nodaro-Client` header so the backend records CLI runs
// distinctly from SDK ones. Read from package.json at BUILD time so it cannot
// drift from the released version.
const pkgVersion = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")).version as string

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  define: { __CLI_VERSION__: JSON.stringify(pkgVersion) },
  external: ["@nodaro/sdk", "@nodaro/shared"],
  // Shebang so the file is directly executable when npm symlinks it as bin.
  banner: { js: "#!/usr/bin/env node" },
})
