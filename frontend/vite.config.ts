import { defineConfig, type Plugin } from "vite"
import react from "@vitejs/plugin-react"
import path from "path"
import fs from "fs"

/**
 * Picker-UI seam (two-mode build): when the PRIVATE `@nodaroai/picker-ui`
 * package is installed (first-party builds; conditional Dockerfile install
 * gated on NPM_TOKEN — same mechanism as `@nodaroai/cloud-plugins`), alias
 * the seam's switch file to it so the app renders the rich pickers + the
 * @-mention prompt editor. Without it (community self-host, public CI) the
 * switch file's own source re-exports the functional stub. tsc never
 * resolves the private module in either lane — the stub is the type
 * contract (see src/lib/picker-ui/).
 */
export function pickerUiAlias(dirname: string): Record<string, string> {
  const pkgDir = path.resolve(dirname, "../node_modules/@nodaroai/picker-ui")
  const installed = fs.existsSync(path.join(pkgDir, "dist", "index.js"))
  // PICKER_UI_FORCE_STUB=1 is the escape hatch for CI/dev: force the
  // community stub lane even when the package is installed, so both lanes
  // can be exercised on one machine.
  const rich = installed && process.env.PICKER_UI_FORCE_STUB !== "1"
  // BARE specifiers, not file paths: vite/rollup alias matches the raw import
  // specifier BEFORE resolution, so aliasing a resolved absolute path of a
  // relative import silently never fires (that bug shipped the stub to every
  // lane until the lane-probe caught it). tsc resolves these via tsconfig
  // `paths` — always to the stub, which is the seam's type contract.
  return {
    "picker-ui-impl": rich
      ? path.join(pkgDir, "dist", "index.js")
      : path.resolve(dirname, "./src/lib/picker-ui/stub.tsx"),
    "picker-ui-impl-styles.css": rich
      ? path.join(pkgDir, "dist", "index.css")
      : path.resolve(dirname, "./src/lib/picker-ui/picker-ui-styles.css"),
  }
}

/**
 * Injects `import React from 'react'` into react-filerobot-image-editor files
 * that use React.createElement without importing React (package bug — 6 files).
 */
function filerobotReactShim(): Plugin {
  return {
    name: "filerobot-react-shim",
    transform(code, id) {
      if (
        id.includes("react-filerobot-image-editor") &&
        code.includes("React.createElement") &&
        !code.includes("import React")
      ) {
        return { code: `import React from "react";\n${code}`, map: null }
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), filerobotReactShim()],
  resolve: {
    alias: {
      ...pickerUiAlias(__dirname),
      "@": path.resolve(__dirname, "./src"),
      "@remotion-pkg": path.resolve(__dirname, "../packages/remotion/src"),
    },
    dedupe: ["remotion", "react", "react-dom"],
  },
  server: {
    port: 3000,
    proxy: {
      "/v1": {
        target: process.env.VITE_API_URL || "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 3000,
    proxy: {
      "/v1": {
        target: process.env.VITE_API_URL || "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    include: [
      "react-filerobot-image-editor",
      "react-konva",
      "konva",
      "styled-components",
    ],
  },
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules/")) return undefined;

          // Scoped packages
          if (id.includes("node_modules/@xyflow/")) return "xyflow";
          if (id.includes("node_modules/@radix-ui/")) return "radix-ui";
          if (id.includes("node_modules/@supabase/")) return "supabase";
          // @tanstack/* — react-query + react-virtual (list virtualization).
          // Grouped together so react-virtual rides the shared vendor chunk
          // instead of bloating the gallery/library route's initial chunk.
          if (id.includes("node_modules/@tanstack/")) return "query-vendor";
          if (id.includes("node_modules/@dnd-kit/")) return "dnd-kit";
          if (id.includes("node_modules/elkjs/")) return "elkjs";
          if (
            id.includes("node_modules/@tiptap/") ||
            id.includes("node_modules/prosemirror-")
          )
            return "tiptap";

          // Markdown + unified ecosystem
          if (
            id.includes("node_modules/react-markdown/") ||
            id.includes("node_modules/remark-") ||
            id.includes("node_modules/micromark") ||
            id.includes("node_modules/mdast-") ||
            id.includes("node_modules/unified/") ||
            id.includes("node_modules/unist-") ||
            id.includes("node_modules/devlop/")
          )
            return "markdown";

          // Remotion (lazy-loaded for Player preview)
          if (
            id.includes("node_modules/remotion/") ||
            id.includes("node_modules/@remotion/")
          )
            return "remotion";

          // Zod standalone
          if (id.includes("node_modules/zod/")) return "zod";

          // React core (after react-markdown etc.)
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/react-router-dom/") ||
            id.includes("node_modules/react-router/") ||
            id.includes("node_modules/scheduler/")
          )
            return "react-vendor";

          // UI utility libs grouped
          if (
            id.includes("node_modules/lucide-react/") ||
            id.includes("node_modules/sonner/") ||
            id.includes("node_modules/class-variance-authority/") ||
            id.includes("node_modules/clsx/") ||
            id.includes("node_modules/tailwind-merge/") ||
            id.includes("node_modules/next-themes/") ||
            id.includes("node_modules/zustand/")
          )
            return "ui-vendor";
        },
      },
    },
  },
})
