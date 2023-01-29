<script setup>
import zhCN from 'ant-design-vue/es/locale/zh_CN';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import { defineAsyncComponent, onMounted, provide, reactive } from 'vue';
import { userAccount } from '@/scripts/api.js'
import { message } from 'ant-design-vue'
import 'ant-design-vue/es/message/style/css'

dayjs.locale('zh-cn');

const user = reactive({
    id: null,
    avatar: '',
    name: '',
    profile: '',
    gender: 0
})


const audio = new Audio()
audio.crossOrigin = 'anonymous'

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
    message.warn('播放失败，可能是' + (player.src.startsWith('blob:') ? '音频格式暂不支持' : '网易云返回的地址访问失败所致'))
    player.stop()
}

const checkLogin = async () => {
    let resp = await userAccount()
    if (resp.account && resp.profile) {
        user.id = resp.account.id
        user.name = resp.profile.nickname
        user.avatar = resp.profile.avatarUrl
        if (resp.profile.gender && resp.profile.birthday) {
            user.gender = resp.profile.gender
            let birthday = dayjs(resp.profile.birthday)
            let years = birthday.format('YY').substring(0, 1) + '0 后'
            let age = birthday.diff(Date.now(), 'year') * -1
            let call = (age < 30 ? '小' : user.gender == 1 ? '老' : '大') + (user.gender == 1 ? '哥哥' : '姐姐')
            user.profile = `${age} 岁的 ${years} ${call} 一枚`
        }
    }
}

provide('player', player);
provide('user', user);
provide('checkLogin', checkLogin);

onMounted(async () => await checkLogin())

const login = defineAsyncComponent(() => import('./components/Login.vue'))
const list = defineAsyncComponent(() => import('./components/List.vue'))
const uploader = defineAsyncComponent(() => import('./components/Uploader.vue'))
const spectrum = defineAsyncComponent(() => import('./components/Spectrum.vue'))


</script>

<template>
    <a-config-provider :locale="zhCN">
        <template v-if="user.name && user.avatar">
            <a-page-header class="userinfo"
            :title="user.name"
                           :sub-title="user.profile"
                           :avatar="{ src: player.cover || user.avatar, size: 'large' }"
                           :class="{ playing: !!player.id }">
                <template #tags>
                    <a-tag v-if="user.gender == 1"
                           color="blue">♂︎</a-tag>
                    <a-tag v-else
                           color="pink">♀︎</a-tag>
                </template>
            </a-page-header>
            <a-tabs :animated="true"
                    size="small">
                <a-tab-pane key="list"
                            tab="网盘音乐列表">
                    <list />
                </a-tab-pane>
                <a-tab-pane key="uploader"
                            tab="本地音乐上传">
                    <uploader />
                </a-tab-pane>
            </a-tabs>
            <spectrum :audio="audio" />
        </template>
        <login v-else />
    </a-config-provider>
</template>

<style>
#app {
    position: relative;
    max-width: 1440px;
    min-width: 960px;
    width: 90%;
    min-height: 100%;
    margin: auto;
}

.ant-page-header,
.ant-tabs {
    padding: 0;
}

.ant-page-header-heading-left,
.ant-tabs-tab {
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

.icn.play {
    width: 0;
    vertical-align: bottom;
    border-left-width: 8px;
    border-left-color: currentColor;
    transform: translate(4px, -1px);
}

.icn.stop {
    width: 10px;
    height: 10px;
    border-width: 2px;
    border-color: currentColor;
}

.ant-progress:hover .icn {
    color: #1890ff
}

.playing .ant-avatar img {
    animation: turn 5s linear infinite;
}

@keyframes turn {
    0% {
        transform: rotate(0deg);
    }

    100% {
        transform: rotate(360deg);
    }
}
</style>
