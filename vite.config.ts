import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8082,
    proxy: {
      // Bypass navigateur pour /functions (préflight/CORS en dev)
      '/functions/v1': {
        target: 'https://wrodvaatdujbpfpvrzge.supabase.co',
        changeOrigin: true,
        secure: true,
      },
    },
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@i18n": path.resolve(__dirname, "./src/lib/i18n"),
      "@locales": path.resolve(__dirname, "./src/locales"),
    },
  },
}));
