import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const commonCfg = defineConfig({
    resolve: {
        alias: {
            '@': '/src',
            'node:buffer': 'buffer',
        }
    },
    plugins: [
        vue()
    ],
    build:{
        chunkSizeWarningLimit: 2048 //这是浏览器插件，没必要限制但文件大小
    }
})

export default ({ command, mode }) => {
    if (command === 'build' && mode === 'watch') {
        let watchCfg = Object.assign({}, commonCfg)
        watchCfg.build ??= {}
        watchCfg.build.watch ??= {}
        return watchCfg
    }
    return commonCfg;
}