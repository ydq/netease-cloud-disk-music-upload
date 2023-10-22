<script setup>
import { inject, onMounted, ref, watch } from 'vue';
import { checkLogin, switchUser, resumeUser, userList } from '@/js/users.js'
import UserCard from './UserCard.vue'


const user = inject('user')
const player = inject('player')


//支持多用户
const users = ref([])

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

</script>
<template>
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
</template>
<style>

</style>