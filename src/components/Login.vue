<script setup>
import { loginKey, checkScan,validCode } from '@/scripts/api.js'
import QRCode from 'qrcode'
import { inject, onMounted, reactive } from 'vue';
import { message } from 'ant-design-vue'
import 'ant-design-vue/es/message/style/css'
import 'ant-design-vue/es/modal/style/css'

const checkLogin = inject('checkLogin')

const qr = reactive({
    show: false,
    key: '',
    url: '',
    msg: '二维码登录',
    code: 800,
    avatar: '',
    nickname: ''
})

async function renewQrcode() {
    let resp = await loginKey()
    qr.key = resp.unikey
    qr.url = await QRCode.toDataURL(`https://music.163.com/login?codekey=${qr.key}`, { margin: 0, errorCorrectionLevel: 'L' })
    await checkQrScan()
}

async function checkQrScan() {
    let resp = await checkScan({ key: qr.key })
    if(!validCode.includes(resp.code)){
        message.warn(resp.message)
        return;
    }
    //800 二维码已失效｜801 等待扫码 ｜802 扫码成功 等待授权 ｜ 803 扫码授权成功
    qr.code = resp.code
    qr.msg = resp.message
    qr.avatar = resp.avatarUrl ||''
    qr.nickname = resp.nickname || ''
    if (resp.code == 803) {
        qr.msg = '登录成功'
        await checkLogin()
        return
    }
    if (resp.code == 800) {
        qr.msg = '重新生成'
        return
    }
    setTimeout(checkQrScan, 1500)
}

const officialWebsiteLogin= () => location.replace('https://music.163.com')

onMounted(() => setTimeout(() => qr.show = true, 300))

</script>
<template>
    <Teleport to="body">
        <a-modal title="登录网易云音乐"
                 cancel-text="官网登录"
                 :visible="qr.show"
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
                           :defaultVisible="true"
                           placement="top">
                    <a-avatar :src="qr.avatar" :size="100"></a-avatar>
                </a-tooltip>
                <img v-else
                     :src="qr.url" />
            </div>
            <span v-else>未能获取到登录用户信息<br>请打开 网易云音乐官网 进行登录 或 使用 二维码登录</span>
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