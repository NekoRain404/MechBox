import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import Components from 'unplugin-vue-components/vite'
import { AntDesignVueResolver } from 'unplugin-vue-components/resolvers'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    base: './',
    plugins: [
      vue(),
      Components({
        resolvers: [
          AntDesignVueResolver({
            importStyle: false,
          }),
        ],
      }),
    ],
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer'),
        '@shared': resolve('src/shared')
      }
    },
    optimizeDeps: {
      include: ['vue', 'vue-router', 'pinia'],
      exclude: ['echarts', 'jspdf', 'html2canvas', 'three', 'xlsx', '@renderer/engine'],
    },
    build: {
      modulePreload: false,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('vite/preload-helper')) return 'vendor-runtime'
            if (!id.includes('node_modules')) return

            if (
              id.includes('/node_modules/vue/') ||
              id.includes('/node_modules/@vue/') ||
              id.includes('vue-router') ||
              id.includes('pinia')
            ) return 'vendor-vue'

            if (id.includes('/node_modules/echarts/')) return 'vendor-echarts'
            if (id.includes('jspdf') || id.includes('html2canvas')) return 'vendor-pdf'
            if (id.includes('/node_modules/xlsx/')) return 'vendor-xlsx'
            if (id.includes('/node_modules/three/')) return 'vendor-three'
          },
        },
      },
    },
    worker: {
      format: 'es'
    }
  }
})
