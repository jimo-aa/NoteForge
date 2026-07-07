import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react()],
  optimizeDeps: {
    include: [
      'codemirror',
      '@codemirror/view',
      '@codemirror/state',
      '@codemirror/lang-markdown',
      '@codemirror/commands',
      '@codemirror/autocomplete',
      '@codemirror/search',
      '@codemirror/language',
      '@codemirror/language-data',
    ],
  },
  build: {
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-i18next', 'i18next'],
          'codemirror-core': ['@codemirror/view', '@codemirror/state', '@codemirror/language', '@codemirror/commands', '@codemirror/search'],
          'codemirror-ext': ['@codemirror/lang-markdown', '@codemirror/language-data', '@codemirror/autocomplete', '@codemirror/lang-javascript', '@codemirror/lang-css', '@codemirror/lang-json', '@codemirror/lang-html', '@codemirror/lang-xml'],
          zustand: ['zustand'],
          'tauri-api': ['@tauri-apps/api/core'],
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? { protocol: "ws", host, port: 1421 }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
