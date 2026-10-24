import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Absolute URL of the live site, used for share-preview tags (og:image must be absolute).
// Set VITE_SITE_URL, or let Vercel's VERCEL_PROJECT_PRODUCTION_URL fill it in automatically.
const siteUrl = (
  process.env.VITE_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "")
).replace(/\/$/, "");

const siteUrlPlugin = () => ({
  name: "site-url-html",
  transformIndexHtml: (html: string) => html.replace(/__SITE_URL__/g, siteUrl),
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    siteUrlPlugin(),
    mode === "development" && componentTagger()
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Libraries that rarely change get their own files so returning players don't re-download them after each deploy.
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          supabase: ["@supabase/supabase-js"],
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
}));
