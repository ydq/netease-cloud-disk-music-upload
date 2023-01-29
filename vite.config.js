import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { AntDesignVueResolver } from 'unplugin-vue-components/resolvers'

const commonCfg = defineConfig({
    resolve: {
        alias: {
            '@': '/src',
            'node:buffer': 'buffer',
        }
    },
    plugins: [
        vue(),
        Components({
            resolvers: [AntDesignVueResolver()]
        })
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