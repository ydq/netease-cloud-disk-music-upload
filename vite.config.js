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