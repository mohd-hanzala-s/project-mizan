import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// ---------------------------------------------------------------------------
// GitHub Pages base path — confirmed against https://github.com/mohd-hanzala-s/project-mizan
// (repo name, not the product name "Mizan by Mikarsh" — the spec's own title
// calls this "Project Atlas," so this is expected, not a mismatch).
//
// Still isolated to this one env var with a fallback, so if the repo is
// ever renamed or moved, it's still a one-line change (or one CI variable).
// ---------------------------------------------------------------------------
const BASE_PATH = process.env.VITE_BASE_PATH ?? "/project-mizan/";

export default defineConfig({
  base: BASE_PATH,
  server: {
    allowedHosts: [".monkeycode-ai.live"],
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Mizan by Mikarsh",
        short_name: "Mizan",
        description:
          "Know exactly where every rupee goes, in under thirty seconds.",
        start_url: BASE_PATH,
        scope: BASE_PATH,
        display: "standalone",
        orientation: "any",
        theme_color: "#10B981", // Emerald 500 — Primary/Income
        background_color: "#FAF9F6", // Light surface token
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Offline-first (§4): precache the app shell so every core screen
        // works with zero network access after first load.
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        navigateFallback: `${BASE_PATH}index.html`,
        cleanupOutdatedCaches: true,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/tests/setup.ts"],
    css: true,
  },
});
