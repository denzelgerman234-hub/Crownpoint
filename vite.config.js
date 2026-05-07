import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const getVendorChunkName = (id) => {
  if (!id.includes('node_modules')) {
    return null
  }

  const packagePath = id.split('node_modules/')[1]

  if (!packagePath) {
    return 'vendor'
  }

  const pathSegments = packagePath.split('/')
  const packageName = pathSegments[0].startsWith('@')
    ? `${pathSegments[0]}-${pathSegments[1]}`
    : pathSegments[0]

  return `vendor-${packageName.replace('@', '')}`
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          return getVendorChunkName(id)
        },
      },
    },
  },
})
