<script setup>
import zhCN from 'ant-design-vue/es/locale/zh_CN';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import { nextTick, onMounted, provide, reactive, ref } from 'vue';
import List from '@/components/List.vue'
import Uploader from '@/components/Uploader.vue'
import { userAccount } from '@/scripts/api.js'
import { spectrumInit } from '@/scripts/spectrum.js'
import { Modal } from 'ant-design-vue'
import 'ant-design-vue/es/modal/style/css'

dayjs.locale('zh-cn');

const user = reactive({
    avatar: '',
    name: '',
    age: '',
    gender: 0
})


const audio = new Audio()
audio.crossOrigin = 'anonymous'

const player = reactive({
    id: null,
    src: null,
    percent: 0,
    currSec: 0,
    play(newId, newSrc) {
        this.id = newId
        audio.src = newSrc
        if (this.src && this.src.startsWith('blob:')) {
            URL.revokeObjectURL(this.src)
        }
        this.src = newSrc
        audio.play()
    },
    stop() {
        audio.pause()
        if (this.src && this.src.startsWith('blob:')) {
            URL.revokeObjectURL(this.src)
        }
        this.id = null
        this.src = null
        this.percent = 0
        this.currSec = 0
    }
})

audio.addEventListener("timeupdate", e => {
    player.currSec = Math.floor(audio.currentTime)
    player.percent = audio.currentTime * 100 / audio.duration
})

audio.addEventListener("ended", e => {
    player.stop(/^\d+$/.test(player.id))
})

const canvasEl = ref()

const checkLogin = async () => {
    let resp = await userAccount()
    if (!resp.account || !resp.profile) {
        Modal.warning({
            title: '获取登录信息失败',
            content: '您可能还没有登录或者登录信息已过期，请打开网易音乐官网进行登录',
            okText: '确定',
            onOk() {
                location.replace('https://music.163.com')
            }
        })
    } else {
        user.name = resp.profile.nickname
        user.avatar = resp.profile.avatarUrl
        if (resp.profile.gender && resp.profile.birthday) {
            user.gender = resp.profile.gender
            let bd = dayjs(resp.profile.birthday)
            let age = bd.diff(Date.now(), 'year') * -1
            let prefix = age < 30 ? '小' : user.gender == 1 ? '老' : '大'
            user.age = `${age} 岁的 ${bd.format('YY').substring(0, 1)}0 后 ${user.gender == 1 ? prefix + '哥哥' : user.gender == 2 ? prefix + '姐姐' : ''} 一枚`
        }
    }
}

provide('player', player);
provide('checkLogin', checkLogin);

onMounted(async () => {
    //检查登录
    await checkLogin()
    nextTick(() => spectrumInit(audio, canvasEl.value))
})


</script>

<template>
    <a-config-provider :locale="zhCN"
        v-if="user.name && user.avatar">
        <a-page-header :title="user.name"
            :sub-title="user.age"
            :avatar="{ src: user.avatar }">
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
                <List />
            </a-tab-pane>
            <a-tab-pane key="uploader"
                tab="本地音乐上传">
                <Uploader />
            </a-tab-pane>
        </a-tabs>
    </a-config-provider>
    <canvas id="spectrumCanvas"
        ref="canvasEl"></canvas>
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

#spectrumCanvas {
    position: absolute;
    width: 960px;
    height: 88px;
    top: 0;
    right: 0;
    transform: rotateY(180deg);
    z-index: -1;
    pointer-events: none;
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

.ant-avatar img {
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
</style>
