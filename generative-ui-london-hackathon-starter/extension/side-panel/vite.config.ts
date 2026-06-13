import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Vite config for the Perceptual Web extension side panel.
 *
 * Output goes to dist/ which is served by the extension via
 * side_panel.default_path in manifest.json (updated in Phase 4 to point at
 * dist/index.html). The plain index.html from Phase 1-3 continues to work
 * until you switch manifest.json to use dist/.
 *
 * Build: pnpm build  (from this directory)
 * Dev:   pnpm dev    (hot-reload, visit http://localhost:5173 directly in Chrome
 *                     OR update manifest's default_path to http://localhost:5173)
 */
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "dist",
    rollupOptions: {
      input: "index.html",
    },
    // Extension pages don't support code-splitting via dynamic import very well.
    // Keep everything in a single bundle to avoid chrome-extension:// module issues.
    chunkSizeWarningLimit: 2000,
  },
  // Resolve CopilotKit peer deps from the parent workspace node_modules.
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  // Side panel is served from a chrome-extension:// origin. Vite dev server
  // needs CORS wide open so the panel can load during development.
  server: {
    cors: true,
    port: 5173,
  },
  // Suppress the "missing peer dep" warning — CopilotKit peer deps are
  // satisfied by the parent workspace.
  optimizeDeps: {
    exclude: [],
  },
});
