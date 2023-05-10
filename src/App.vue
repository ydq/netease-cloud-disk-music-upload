<script setup>
import zhCN from 'ant-design-vue/es/locale/zh_CN';
import { defineAsyncComponent, onMounted, provide, reactive, ref, watch } from 'vue';
import { checkLogin, switchUser, resumeUser, userList } from '@/js/users.js'
import { message } from 'ant-design-vue'
import 'ant-design-vue/es/message/style/css'


const user = reactive({
    id: null,
    avatar: '',
    name: '',
    profile: '',
    gender: 0
})



const users = ref([])


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


provide('player', player);
provide('user', user);

onMounted(async () => {
    let check = await checkLogin(user)
    if (check) {
        users.value = userList(user.id)
    }
})


async function switchAssignUser(id) {
    //保存当前的用户ID，防止切换的用户 cookie 失效 再切回来
    let currUserId = user.id
    let resume = await resumeUser(user, id)
    if (!resume) {
        await resumeUser(user, currUserId)
    }
}

watch(() => user.id, id => users.value = userList(id))


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
                <template #extra>
                    <div id="multi-user">
                        <a-tooltip title="登录新账号"
                                   placement="bottom">
                            <a-avatar @click="switchUser(user)">╋</a-avatar>
                        </a-tooltip>

                        <template v-if="users.length">
                            <a-tooltip v-for="u in users"
                                       :title="`切换【${u.name}】`"
                                       placement="bottom">
                                <a-avatar :src="u.avatar"
                                          @click="switchAssignUser(u.id)" />
                            </a-tooltip>
                        </template>

                    </div>
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
</style>
