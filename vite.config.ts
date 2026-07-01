import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { versionJsonPlugin } from "./plugins/vite-version-json";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    versionJsonPlugin(mode),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("recharts") || id.includes("d3-")) return "charts";
          if (id.includes("jspdf") || id.includes("html2canvas")) return "pdf";
          if (id.includes("xlsx")) return "xlsx";
          if (id.includes("@radix-ui")) return "radix-ui";
          if (id.includes("@tanstack/react-query")) return "react-query";
          if (id.includes("react-router")) return "router";
        },
      },
    },
  },
}));
