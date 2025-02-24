import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { AntDesignVueResolver } from 'unplugin-vue-components/resolvers'
import VueRouter from 'unplugin-vue-router/vite'

const commonCfg = defineConfig({
    resolve: {
        alias: {
            'node:buffer': 'buffer',
            'node:stream': 'stream',
        }
    },
    plugins: [
        VueRouter(),
        vue(),
        Components({
            resolvers: [
                AntDesignVueResolver({importStyle:false}),
            ],
        }),
    ],
    build: {
        chunkSizeWarningLimit: 2048, //这是浏览器插件，没必要限制单文件大小
        rollupOptions: {
            input:{
                default: 'index.html',
                lite: 'lite.html',
            }
        }
    }
})

export default ({ command, mode }) => {
    if (command === 'build' && mode === 'watch') {
        commonCfg.build ??= {}
        commonCfg.build.watch ??= {}
    }
    return commonCfg
}