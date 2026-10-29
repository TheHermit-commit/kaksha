import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  // In development the doubt tutor runs on the Node server (npm run server).
  server: { proxy: { '/api': 'http://localhost:8787' } },
  test: { globals: true },
});
