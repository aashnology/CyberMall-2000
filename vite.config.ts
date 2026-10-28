import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative base: the build works from any path, including https://<user>.github.io/<repo>/ (GitHub Pages project sites).
  base: './',
  plugins: [react()],
  worker: { format: 'es' },
  server: { port: 5173 },
  test: { environment: 'node', include: ['tests/**/*.test.{ts,tsx}'] },
});
