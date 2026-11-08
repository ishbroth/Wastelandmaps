import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // the map data (thousands of small files that the data tools rewrite) is read as it is: the dev server need not watch it, or it spends its time on every change
  server: { watch: { ignored: ['**/public/data/**', '**/_data/**', '**/renders-archive/**'] } },
})
