import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const allowedHosts = (env.VITE_DEV_ALLOWED_HOSTS ?? 'policy.nickelcy.com')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean)
  const disableHmr = (env.VITE_DEV_HMR ?? 'false').toLowerCase() === 'false'

  return {
    plugins: [react()],
    server: {
      host: true, // Listen on all addresses
      allowedHosts,
      hmr: disableHmr ? false : undefined,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  }
})
