import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import svgr from "vite-plugin-svgr";

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 5173,
    // Allow all hosts - Nginx handles security at the entry point
    // This allows access from hrms.orangetechnolab.com and IP addresses
    allowedHosts: true,
    strictPort: false,
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
