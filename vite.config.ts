import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Project site lives at https://stevologic.github.io/storyteller-ai/
// so production assets need that base path. Local dev serves from root.
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/storyteller-ai/' : '/',
  plugins: [react()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
  },
}));
