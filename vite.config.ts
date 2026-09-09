import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 550,
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('/firebase/')) {
              if (id.includes('/app-check')) return 'firebaseAppCheck';
              if (id.includes('/auth')) return 'firebaseAuth';
              if (id.includes('/firestore')) return 'firebaseFirestore';
              return 'firebaseCore';
            }
            if (id.includes('/react/') || id.includes('/react-dom/')) return 'react';
            if (id.includes('/recharts/')) return 'charts';
            if (id.includes('/lucide-react/')) return 'icons';
            if (id.includes('/motion/')) return 'motion';
            return undefined;
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
