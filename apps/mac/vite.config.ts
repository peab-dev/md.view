import { defineConfig } from 'vite';
import electron from 'vite-plugin-electron/simple';
import { resolve } from 'node:path';

const distRoot = resolve(__dirname, 'dist-electron');

export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  base: './',
  build: {
    outDir: resolve(distRoot, 'renderer'),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'src/renderer/index.html')
    }
  },
  plugins: [
    electron({
      main: {
        entry: resolve(__dirname, 'src/main/index.ts'),
        vite: {
          build: {
            outDir: resolve(distRoot, 'main'),
            emptyOutDir: true,
            // Force CommonJS — Electron's main process expects CJS, and our
            // package.json deliberately omits `"type": "module"` to match.
            lib: {
              entry: resolve(__dirname, 'src/main/index.ts'),
              formats: ['cjs'],
              fileName: () => 'index.cjs'
            },
            rollupOptions: {
              external: ['electron', 'chokidar', 'fsevents']
            }
          }
        }
      },
      preload: {
        input: resolve(__dirname, 'src/preload/index.ts'),
        vite: {
          build: {
            outDir: resolve(distRoot, 'preload'),
            emptyOutDir: true,
            lib: {
              entry: resolve(__dirname, 'src/preload/index.ts'),
              formats: ['cjs'],
              fileName: () => 'index.cjs'
            },
            rollupOptions: {
              external: ['electron']
            }
          }
        }
      }
    })
  ]
});
