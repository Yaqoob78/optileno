import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const pkgPath = "/node_modules/";
          if (!id.includes(pkgPath)) return;

          const inPkg = (name) => id.includes(`${pkgPath}${name}/`);

          if (
            inPkg("react") ||
            inPkg("react-dom") ||
            inPkg("react-router-dom") ||
            inPkg("zustand")
          ) {
            return "vendor";
          }

          if (
            inPkg("recharts") ||
            inPkg("chart.js") ||
            inPkg("react-chartjs-2")
          ) {
            return "charts";
          }

          if (
            inPkg("framer-motion") ||
            inPkg("lucide-react") ||
            inPkg("clsx") ||
            inPkg("tailwind-merge")
          ) {
            return "ui";
          }
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  server: {
    host: true,
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      }
    }
  }
});
