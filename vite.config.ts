import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The site is served from the apex custom domain https://tinybookbuddies.ai/,
// so assets live at the root path in both dev and production.
export default defineConfig(() => ({
  base: '/',
  plugins: [react()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
  },
}));
