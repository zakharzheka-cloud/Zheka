import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `SINGLE_FILE=1 vite build` inlines everything into one self-contained
// index.html (used for the phone-playable build served via raw.githack).
const single = process.env.SINGLE_FILE === '1';

export default defineConfig({
  base: './',
  plugins: single ? [viteSingleFile()] : [],
  server: {
    host: true,
    port: 5173,
  },
  build: {
    target: 'es2020',
    outDir: single ? 'docs' : 'dist',
    emptyOutDir: true,
    // Default (Pages) build ships both the 2D game and the 3D demo page.
    rollupOptions: single
      ? undefined
      : {
          input: {
            main: 'index.html',
            three: 'three.html',
          },
        },
  },
});
