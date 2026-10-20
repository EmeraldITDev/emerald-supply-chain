import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
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
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null,
      devOptions: { enabled: false },
      filename: "sw.js",
      includeAssets: [
        "favicon.ico",
        "icons/favicon-16.png",
        "icons/favicon-32.png",
        "icons/favicon-48.png",
        "icons/favicon-dark-16.png",
        "icons/favicon-dark-32.png",
        "icons/favicon-dark-48.png",
        "icons/apple-touch-icon.png",
        "icons/pwa-192x192.png",
        "icons/pwa-512x512.png",
        "icons/pwa-maskable-192x192.png",
        "icons/pwa-maskable-512x512.png",
        "brand/EMERALD_Scm_DARK_png.png",
        "brand/EMERALD_Scm_LIGHT_png.png",
      ],
      manifest: {
        name: "Emerald SCM",
        short_name: "SCM",
        description: "Enterprise Supply Chain Management System",
        start_url: "/",
        scope: "/",
        display: "standalone",
        // Brand hex sampled from design/icons/EMERALD_Scm_DARK_png.png (#0E5070).
        // Bump cache via icon paths / includeAssets when regenerating (icons v2).
        background_color: "#0E5070",
        theme_color: "#0E5070",
        orientation: "portrait-primary",
        categories: ["business", "productivity"],
        icons: [
          {
            src: "/icons/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/pwa-maskable-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "/icons/pwa-maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        globIgnores: ["**/version.json"],
        navigateFallback: null,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        // Off: Chrome logs "navigation preload request was cancelled" and it
        // can delay first paint when the preload race loses to the real nav.
        navigationPreload: false,
        runtimeCaching: [
          {
            // HTML navigations: always try the network first so deploys and
            // auth redirects are never served from a stale cache.
            urlPattern: ({ request, url }: { request: Request; url: URL }) =>
              request.mode === "navigate" && !url.pathname.startsWith("/~oauth"),
            handler: "NetworkFirst",
            options: {
              cacheName: "html-navigations",
              // Fall back to cache quickly on slow links instead of waiting 10s.
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
          {
            // Same-origin hashed build assets only.
            urlPattern: ({ url, sameOrigin }: { url: URL; sameOrigin: boolean }) =>
              sameOrigin && url.pathname.startsWith("/assets/"),
            handler: "CacheFirst",
            options: {
              cacheName: "static-assets",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
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
