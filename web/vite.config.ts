import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 前端纯客户端,后端在 :8787。dev 直接连 ws://localhost:8787/ws + http://localhost:8787/api。
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, host: true },
});
