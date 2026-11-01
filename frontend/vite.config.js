import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In Docker the Django service is reachable as "web"; locally it's localhost
const backendHost = process.env.BACKEND_HOST || "localhost:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": { target: `http://${backendHost}`, changeOrigin: true },
      "/ws": { target: `ws://${backendHost}`, ws: true, changeOrigin: true },
    },
  },
});
