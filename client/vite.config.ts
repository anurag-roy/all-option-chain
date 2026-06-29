import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    // Tanstack Router
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    // React
    react(),
    // Tailwind CSS
    tailwindcss(),
  ],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      '@client': path.resolve(__dirname, './src'),
      '@server': path.resolve(__dirname, '../server'),
      '@shared': path.resolve(__dirname, '../server/shared'),
      react: path.resolve(__dirname, '../node_modules/react'),
      'react-dom': path.resolve(__dirname, '../node_modules/react-dom'),
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', '@tanstack/react-table'],
  },
  server: {
    proxy: {
      '/api': {
        target: `http://localhost:3000`,
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
