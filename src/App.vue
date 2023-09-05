<script setup>
import zhCN from 'ant-design-vue/es/locale/zh_CN';
import { defineAsyncComponent, onMounted, provide, reactive, ref, watch } from 'vue';
import { checkLogin, switchUser, resumeUser, userList } from '@/js/users.js'
import { message, theme } from 'ant-design-vue'

//当前用户的信息 组入给子组件，便于根据当前登录的用户获取一些接口信息
const user = reactive({
    id: null,
    avatar: '',
    name: '',
    profile: '',
    gender: 0
})

//支持多用户
const users = ref([])

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


//刷新多用户的用户列表（用户列表不显示当前用户）
function reloadUserList() {
    users.value = userList(user.id)
}

//初始化时检查用户登录情况，如果已经登录了，则刷新一下用户列表
onMounted(async () => {
    let check = await checkLogin(user)
    if (check) {
        reloadUserList()
    }
})

//切换用户（从 localStorage 中 恢复 cookie 并写入到浏览器 以达到不用频繁扫码切换用户的目的）
async function changeUser({ oldId, state }) {
    //保存当前的用户ID，防止切换的用户 cookie 失效 再切回来
    if (!state) {
        await resumeUser(user, oldId)
    }
}

//当切换用户时刷新一下用户列表（用户列表不显示当前用户）
watch(() => user.id, reloadUserList)

//一些子组件
const login = defineAsyncComponent(() => import('./components/Login.vue'))
const list = defineAsyncComponent(() => import('./components/List.vue'))
const uploader = defineAsyncComponent(() => import('./components/Uploader.vue'))
const spectrum = defineAsyncComponent(() => import('./components/Spectrum.vue'))
const userCard = defineAsyncComponent(() => import('./components/UserCard.vue'))





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
            <a-page-header class="userinfo"
                           :title="user.name"
                           :sub-title="user.profile"
                           :class="{ playing: !!player.id }"
                           @back="() => player.stop()">
                <template #backIcon>
                    <a-tooltip :title="!!player.id ? '点击停止播放' : ''">
                        <a-avatar size="large"
                                  :src='player.cover || user.avatar'>🎶</a-avatar>
                    </a-tooltip>
                </template>
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

                            <user-card v-for="u in users"
                                       :user-context="user"
                                       :user="u"
                                       @change="changeUser"
                                       @delete="reloadUserList" />
                        </template>

                    </div>
                </template>
            </a-page-header>
            <a-tabs size="small"
                    animated>
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
}
</style>
