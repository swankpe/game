import { defineConfig } from 'vite';

export default defineConfig({
  // Three.js pèse à lui seul environ 600 ko : ce n'est pas un oubli de découpage.
  build: { chunkSizeWarningLimit: 900 },
});
