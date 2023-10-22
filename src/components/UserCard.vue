<script setup>
import { resumeUser, delUser } from '@/js/users.js'
//多用户登录快速切换的单个用户小卡组件
const props = defineProps({
    userContext: Object,
    user: Object,
    placement: {
        type: String,
        default: 'bottom'
    },
    size: {
        type: String,
        default: 'default'
    }
})
const emits = defineEmits(['change', 'delete'])

//点击切换用户的方法（从localStorage中取出指定用户的cookie，写入至浏览器）
async function changeUser() {
    let oldId = props.userContext?.id
    let state = await resumeUser(props.userContext, props.user.id)
    emits('change', { oldId, state, usr: props.user })
}

//删除指定用户记录（删除 localStorage）
function deleteUser() {
    delUser(props.user.id)
    emits('delete', { usr: props.user })
}

</script>
<template>
    <a-tooltip :placement="props.placement">
        <template #title>
            <div class="user_ops">
                {{ props.user.name }}<br><span @click="changeUser">快速登录</span>｜<span @click="deleteUser">删除记录</span>
            </div>
        </template>
        <a-avatar :src="props.user.avatar"
                  :size="props.size"
                  style="box-shadow: 0 0 0 1px #ccc;"></a-avatar>
    </a-tooltip>
</template>
<style>
.user_ops {
    text-align: center;
}

.user_ops span:hover {
    cursor: pointer;
    border-bottom: 1px solid #fff;
}
</style>