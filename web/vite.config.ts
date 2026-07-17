import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev, proxy API + webhook to the backend so the app runs on one origin.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8080",
      "/webhook": "http://localhost:8080",
      "/health": "http://localhost:8080",
    },
  },
});
