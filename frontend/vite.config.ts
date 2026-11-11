import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const backend = process.env.OVIR_GUI_BACKEND ?? "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
    dedupe: ["react", "react-dom"],
  },
  build: {
    outDir: "../src/ovir_gui/web/static",
    emptyOutDir: true,
    chunkSizeWarningLimit: 1024,
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
  server: {
    proxy: {
      "/api": { target: backend, ws: true },
    },
  },
});
