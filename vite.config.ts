import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './', // <--- ודאי שהשורה הזו קיימת בדיוק כך
  build: {
    outDir: 'dist',
  }
})