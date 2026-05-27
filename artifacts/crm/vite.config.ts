import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// PORT is only used by the dev/preview server, not during `vite build`.
// Fall back to 5173 in environments (e.g. Vercel CI) that don't set PORT.
const port = process.env.PORT ? Number(process.env.PORT) : 5173;

// BASE_PATH is used by the Replit reverse-proxy. Default to "/" everywhere else.
const basePath = process.env.BASE_PATH ?? "/";

// Load Replit-specific dev plugins only when running inside Replit.
const isReplit = !!process.env.REPL_ID;
const isDev = process.env.NODE_ENV !== "production";

const replitPlugins = isReplit && isDev
  ? await Promise.all([
      import("@replit/vite-plugin-runtime-error-modal").then((m) => m.default()),
      import("@replit/vite-plugin-cartographer").then((m) =>
        m.cartographer({ root: path.resolve(import.meta.dirname, "..") }),
      ),
      import("@replit/vite-plugin-dev-banner").then((m) => m.devBanner()),
    ])
  : [];

export default defineConfig({
  base: basePath,
  plugins: [react(), tailwindcss(), ...replitPlugins],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    // Output to the repo root's dist/ so Vercel finds it regardless of
    // whether Root Directory is set to the repo root or artifacts/crm.
    outDir: path.resolve(import.meta.dirname, "../../dist"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: { strict: true },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
