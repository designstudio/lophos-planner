import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          if (id.includes('react') || id.includes('scheduler')) {
            return 'react-vendor';
          }

          if (id.includes('@supabase')) {
            return 'supabase-vendor';
          }

          if (id.includes('lottie-react') || id.includes('lottie-web')) {
            return 'lottie-vendor';
          }

          if (id.includes('marked') || id.includes('dompurify') || id.includes('turndown')) {
            return 'content-vendor';
          }

          if (id.includes('sortablejs') || id.includes('react-sortablejs')) {
            return 'sorting-vendor';
          }
        },
      },
    },
  },
})
