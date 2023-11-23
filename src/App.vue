<script setup>
import zhCN from 'ant-design-vue/es/locale/zh_CN';
import { defineAsyncComponent, onMounted, provide, reactive, ref, watch } from 'vue';
import { message, theme } from 'ant-design-vue'
import { checkLogin } from './js/users.js'
import { useRoute, useRouter } from 'vue-router';
import AppHead from './components/AppHead.vue';

const route = useRoute()
const router = useRouter()

//当前用户的信息 组入给子组件，便于根据当前登录的用户获取一些接口信息
const user = reactive({
    id: null,
    avatar: '',
    name: '',
    profile: '',
    gender: 0
})


onMounted(async () => {
    await checkLogin(user)
})

//底层音频播放器
const audio = new Audio()
audio.crossOrigin = 'anonymous'

//简单封装一下播放器 注入给子组件
const player = reactive({
    id: null,
    src: null,
    cover: null,
    percent: 0,
    currSec: 0,
    play(newId, newSrc, cover) {
        this.id = newId
        audio.src = newSrc
        if (this.src && this.src.startsWith('blob:')) {
            URL.revokeObjectURL(this.src)
        }
        this.src = newSrc
        this.cover = cover
        audio.play()
    },
    stop() {
        audio.pause()
        if (this.src && this.src.startsWith('blob:')) {
            URL.revokeObjectURL(this.src)
        }
        this.id = null
        this.src = null
        this.cover = null
        this.percent = 0
        this.currSec = 0
    }
})

audio.onended = e => player.stop()
audio.ontimeupdate = e => {
    player.currSec = Math.floor(audio.currentTime)
    player.percent = audio.currentTime * 100 / audio.duration
}
audio.onerror = e => {
    message.warn('播放失败，可能是' + (player.src.startsWith('blob:') ? '浏览器不支持当前的音频格式（但可能不影响上传）' : '浏览器不支持的格式或网易云返回的地址访问失败所致'))
    player.stop()
}



//一些子组件
const login = defineAsyncComponent(() => import('./components/Login.vue'))
const spectrum = defineAsyncComponent(() => import('./components/Spectrum.vue'))


const current = ref(['list'])

const init = watch(route, route => {
    current.value = [route.name]
    init()
})

watch(current, page => {
    if (page[0] != 'lite') {
        router.replace({ name: page[0] })
    } else {
        let width = 400, height = 680;
        window.open('lite.html', 'ncu_lite', `popup=1,location=0,menubar=0,resizable=0,scrollbars=0,status=0,titlebar=0,toolbar=0,width=${width},height=${height},left=${(window.screen.width - width) / 2},top=${(window.screen.height - height) / 2}`)
        window.close()
    }
})

//系统深色主题自动监听探测 并注入给下游组件使用
const themeMedia = window.matchMedia("(prefers-color-scheme: dark)");
const isDark = ref(themeMedia.matches)
themeMedia.addEventListener('change', e => isDark.value = e.matches);


provide('player', player);
provide('user', user);
provide('isDark', isDark);//后续如果有一些自定义的元素需要根据深色主题定制效果可以使用这个

</script>

<template>
    <a-config-provider :locale="zhCN"
                       :theme="{ token: { fontFamily: 'jbt', fontSize: 16, controlHeight: 36 }, algorithm: isDark ? [theme.compactAlgorithm, theme.darkAlgorithm] : theme.compactAlgorithm }">
        <template v-if="user.name && user.avatar">
            <app-head />
            <a-menu v-model:selectedKeys="current"
                    mode="horizontal">
                <a-menu-item key="list">网盘音乐列表</a-menu-item>
                <a-menu-item key="uploader">本地音乐上传</a-menu-item>
                <a-menu-item key="lite">
                    <a-tooltip title="适配移动设备"
                               placement="right">Lite版</a-tooltip>
                </a-menu-item>
            </a-menu>
            <router-view v-slot="{ Component }">
                <transition name="page">
                    <KeepAlive>
                        <component :is="Component" />
                    </KeepAlive>
                </transition>
            </router-view>
            <spectrum :audio="audio" />
        </template>
        <login v-else />
    </a-config-provider>
</template>

<style>
@font-face {
    font-family: jbt;
    src: url('/fonts/jbt.woff2');
}

#app {
    position: relative;
    max-width: 1440px;
    min-width: 960px;
    width: 90%;
    min-height: 100%;
    margin: auto;
}

.page-enter-active,
.page-leave-active {
    transition: all .3s ease;
    position: absolute !important;
}

.page-enter-from,
.page-leave-to {
    transform: translateY(20px);
    opacity: 0;
}

.ant-page-header {
    padding: 0;
}

.ant-menu-light {
    background: transparent;
}

.ant-page-header-heading-left,
.ant-menu-item {
    backdrop-filter: blur(3px);
}

.ant-tabs-nav {
    margin-bottom: 5px !important;
}

.ant-page-header {
    padding-top: 10px;
}

.userinfo img {
    border: 1px solid #aaa;
    border-radius: 50%;
}

.ant-table-row:nth-child(even) {
    background-color: #fafafa;
}

.icn {
    display: inline-block;
    box-sizing: border-box;
    height: 0;
    border-color: transparent;
    border-style: solid;
    border-width: 5px;
    transition: all .3s ease;
    color: #666;
}

.ant-progress:hover .icn {
    color: #1890ff
}

.ant-page-header {
    background: transparent;
}

.ant-page-header .ant-page-header-back {
    margin-right: 0;
}

.playing .ant-page-header-heading-left .ant-avatar img {
    animation: turn 5s linear infinite;
}

#multi-user .ant-avatar {
    cursor: pointer;
    opacity: .3;
    transition: all .2s ease-in-out;
}

#multi-user .ant-avatar:hover {
    opacity: 1;
}

@keyframes turn {
    0% {
        transform: rotate(0deg);
    }

    100% {
        transform: rotate(360deg);
    }
}

@media (prefers-color-scheme: dark) {
    :root {
        background-color: #141414;
    }

    .ant-table-row:nth-child(even) {
        background-color: rgb(29, 29, 29);
    }
}</style>
