import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    /** Storex API only allows Origin https://storex.io — proxy so the SPA can call Fireblocks routes same-origin. */
    proxy: {
      "/api/storex": {
        target: "https://api.storex.io",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/storex/, ""),
      },
    },
  },
  preview: {
    port: 8080,
    proxy: {
      "/api/storex": {
        target: "https://api.storex.io",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/storex/, ""),
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
});
