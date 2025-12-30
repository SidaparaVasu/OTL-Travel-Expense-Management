import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import svgr from "vite-plugin-svgr";

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: [
      ".ngrok-free.app",
      "192.168.1.90",
      "hrms.orangetechnolab.com",
      "120.72.91.77",
      "120.72.91.78",
    ],
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
