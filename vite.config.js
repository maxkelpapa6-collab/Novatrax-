import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

// En développement, les appels /api, /functions et /files sont transmis au
// serveur NOVATRAX (npm run dev:server, port 3000).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/functions': 'http://localhost:3000',
      '/files': 'http://localhost:3000'
    }
  }
});
