import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import svgr from "vite-plugin-svgr";

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 5173,
    // Nginx reverse proxy will handle domain routing
    // Vite just needs to accept connections from any host
  },
  build: {
    outDir: "dist",
  },
  plugins: [react(), svgr()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
  ssr: {
    noExternal: ["react-helmet-async"],
  },
});
