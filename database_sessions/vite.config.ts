import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // Same-origin topology (PRD 4.2): the browser only ever talks to :5173.
    proxy: { '/api': { target: 'http://localhost:5154', changeOrigin: false } },
  },
  build: {
    // SR-4: never publish source maps.
    sourcemap: false,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
});
