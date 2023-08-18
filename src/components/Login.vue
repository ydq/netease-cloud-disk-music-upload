<script setup>
import { loginKey, checkScan, validCode } from '@/js/api.js'
import { checkLogin, userList } from '@/js/users.js'
import QRCode from 'qrcode'
import { defineAsyncComponent, inject, onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue'

//从App.vue 中注入的 当前的用户
const user = inject('user')

//如果用户使用 二维码登录 则该对象为 二维码登录需要的一些信息
const qr = reactive({
    show: false,
    key: '',
    url: '',
    msg: '二维码登录',
    code: 800,
    avatar: '',
    nickname: ''
})

//多用户管理时 从 localStorage 中获取的用户列表信息
const users = ref([])

//重新生成二维码
async function renewQrcode() {
    let resp = await loginKey()
    qr.key = resp.unikey
    qr.url = await QRCode.toDataURL(`https://music.163.com/login?codekey=${qr.key}`, { margin: 0, errorCorrectionLevel: 'L' })
    await checkQrScan()
}

//检查用户二维码扫码的状态
async function checkQrScan() {
    let resp = await checkScan({ key: qr.key })
    if (!validCode.includes(resp.code)) {
        message.warn(resp.message)
        return;
    }
    //800 二维码已失效｜801 等待扫码 ｜802 扫码成功 等待授权 ｜ 803 扫码授权成功
    qr.code = resp.code
    qr.msg = resp.message
    qr.avatar = resp.avatarUrl || ''
    qr.nickname = resp.nickname || ''
    if (resp.code == 803) {
        qr.msg = '登录成功'
        await checkLogin(user)
        return
    }
    if (resp.code == 800) {
        qr.msg = '重新生成'
        return
    }
    setTimeout(checkQrScan, 1500)
}

//用户点击使用官网登录时 直接跳转到 网易云官网去
const officialWebsiteLogin = () => location.replace('https://music.163.com')

onMounted(async () => {
    users.value = await userList()
    //防止闪烁，延迟一下 显示 登录窗口的 Modal 窗口
    setTimeout(() => qr.show = true, 300)
})

//用户点 多用户列表卡快速登录之后的 callback 如果登录失败（Cookie失效）则提示一下，并刷新一下多用户的列表
async function quickLogin({ usr, state }) {
    if (!state) {
        message.info(`快速登录【${usr.name}】失败，可能是 Cookie 已过期，请使用官网或扫码登录`)
        users.value = await userList()
    }
}

//移除指定的历史多用户记录之后的回调函数，需要刷新一下多用户的列表
const removeHistory = async () => {
    users.value = await userList()
}

//多用户登录时的 用户卡片组件
const userCard = defineAsyncComponent(() => import('@/components/UserCard.vue'))

</script>
<template>
    <Teleport to="body">
        <a-modal title="登录网易云音乐"
                 cancel-text="官网登录"
                 :open="qr.show"
                 :closable="false"
                 :width="380"
                 :mask-closable="false"
                 :ok-text="qr.msg"
                 :ok-button-props="{ disabled: qr.code != 800 }"
                 @ok="renewQrcode"
                 @cancel="officialWebsiteLogin">
            <div v-if="qr.url"
                 id="qrcode"
                 :class="{ timeout: qr.url && qr.code == 800 }">
                <a-tooltip v-if="qr.avatar"
                           :title="qr.nickname"
                           :open="true"
                           placement="top">
                    <a-avatar :src="qr.avatar"
                              :size="100"></a-avatar>
                </a-tooltip>
                <img v-else
                     :src="qr.url" />
            </div>
            <span v-else>未能获取到登录用户信息<br>请打开 <a-typography-text underline>网易云音乐官网</a-typography-text> 进行登录 或 使用 二维码登录</span>
            <div v-if="users.length">
                <a-divider plain>快速登录</a-divider>
                <p>
                    <a-typography-text type="secondary">您曾经登录过以下账号 可以尝试快速登录</a-typography-text>
                </p>
                <div style="overflow: hidden;">
                    <a-space size="middle"
                             align="center">
                        <user-card v-for="u in users"
                                   :user-context="user"
                                   :user="u"
                                   size="large"
                                   @change="quickLogin"
                                   @delete="removeHistory" />
                    </a-space>
                </div>
            </div>
        </a-modal>
    </Teleport>
</template>
<style>
#qrcode {
    text-align: center;
    position: relative;
}

#qrcode img {
    max-width: 150px;
}

.avatar {
    border-radius: 50%;
}

.timeout::after {
    content: '二维码已过期';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 6.5rem;
    background: rgba(0, 0, 0, .3);
    text-shadow: 0 0 5px #fff;
    text-align: center;
    border-radius: .3rem;
}

.timeout img {
    filter: opacity(.1);
}
</style>