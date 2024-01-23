<script setup>
import zhCN from 'ant-design-vue/es/locale/zh_CN';
import { message } from 'ant-design-vue'
import { checkLogin } from '/src/js/users.js'
import { calcFileMd5 } from '/src/js/helper.js'
import { parseBuffer as metaData } from 'music-metadata'
import { Buffer } from 'buffer'
import { cloudGet, uploadCheck, uploadToken, uploadFile, cloudInfo, cloudPub, validCode } from '/src/js/api.js'
import { onMounted, provide, reactive, ref } from 'vue';
import Login from './components/Login.vue';
import LiteList from './components/LiteList.vue';

import { Modal } from 'ant-design-vue';


window.Buffer = Buffer;

const listComponent = ref()

const user = reactive({
    id: null,
    avatar: '',
    name: '',
    profile: '',
    gender: 0
})

provide('user', user);

onMounted(async () => {
    await checkLogin(user)
})

const loadData = async (offset, isRetry = false) => {
    cloud.loading = true
    cloud.selectedRowKeys = []
    let resp = await cloudGet({ limit: 100, offset })
    if (!validCode.includes(resp.code)) {
        if (isRetry) {
            message.warn('获取网盘数据失败，请稍后重试或者要不试试重新登录～')
        } else {
            await checkLogin(user)
            loadData(offset, true)
        }
        return
    }
    if (offset == 0) {
        cloud.allData = resp.data.map(convert)
    } else {
        cloud.allData = cloud.allData.concat(resp.data.map(convert))
    }
    if (resp.data.length < 100) {
        cloud.loading = false
        return;
    }
    await loadData(offset + 100)
}

const uploader = reactive({
    filesKey: Date.now(),
    file: null,
    editor: false,
    progress: null,
    data: {},
    autoRetry: false
})

const changeFile = async e => {
    const file = e.target.files[0]
    uploader.filesKey = Date.now()
    let check = file.type.toLowerCase().startsWith('audio/')
        || file.type.toLowerCase().endsWith('/x-ms-wma') // video/x-ms-wma
        || file.type.toLowerCase().endsWith('/mp4')
        || file.name.toLowerCase().endsWith('.ape')
    if (!check) {
        message.warn('您选择的文件可能不被支持');
        return
    }
    let ext = file.name.match(/\.(?<ext>\w+)$/).groups.ext.toUpperCase()
    let tag = null;
    try {
        let meta = await metaData(Buffer.from(await file.arrayBuffer()), file.type)
        if (meta && meta.common) {
            tag = meta.common
        }
    } catch (e) {
        message.info(`自动解析【${file.name}】的 元数据 信息失败`)
    }
    uploader.data = {
        filename: file.name,
        song: tag?.title || file.name,
        artist: tag?.artist || '',
        album: tag?.album || '',
        file,
        ext
    }
    uploader.show = true
}



const upload = async (isRetry = false) => {
    uploader.show = false
    const data = uploader.data
    //初始化一个进度条，防止频繁点击
    uploader.progress = 0

    const md5 = await calcFileMd5(data.file, isRetry) //接口重试时 如果传入了MD5 则不重复计算

    const ext = data.ext
    const filename = data.filename
        .replace('.' + ext, '')
        .replace(/\s/g, '')
        .replace(/\./g, '_')

    let checkResp = await uploadCheck({ md5, length: data.file.size })

    if (!validCode.includes(checkResp.code)) {
        await fail('上传前置检查', isRetry)
        return
    }

    let tokenResp = await uploadToken({ ext, md5, filename })

    if (!validCode.includes(tokenResp.code)) {
        await fail('获取上传Token', isRetry)
        return
    }

    if (checkResp && checkResp.needUpload) {
        try {
            await uploadFile({
                file: data.file,
                md5,
                objectKey: tokenResp.result.objectKey,
                token: tokenResp.result.token
            }, isRetry, e => {
                uploader.progress = e.progress == 1 ? 99 : Math.floor(e.progress * 100)
            })
        } catch (e) {
            await fail('文件上传', isRetry)
            return
        }
    }
    let infoResp = await cloudInfo({
        md5,
        songid: checkResp.songId,
        filename: data.filename,
        song: data.song,
        album: data.album,
        artist: data.artist,
        resourceId: tokenResp.result.resourceId,
    })

    if (!validCode.includes(infoResp.code)) {
        await fail('更新文件信息', isRetry)
        return
    }

    let resp = await cloudPub({ songid: infoResp.songId })

    if (validCode.includes(resp.code)) {
        message.success(`${data.filename}上传成功`)
        uploader.progress = null
        await listComponent.value.reload()
    } else {
        await fail('保存到网盘', isRetry)
    }
}

const fail = async (ops, isRetry) => {
    uploader.progress = null

    if (uploader.autoRetry) {
        if (isRetry) {
            message.warn(`${ops}失败了，但手动重试几次或换个时间段再试没准会有奇效～`)
        } else {
            message.info('上传发生了一点问题，正在自动重试...')
            await upload(true)
        }
    } else {
        message.warn(`${ops}失败了，试试自动上传没准会有奇效～`)
    }
}

const switchAutoRetry = state => {
    if (!state) {
        message.info('已关闭自动重试')
        return
    }
    Modal.confirm({
        title: '开启上传失败后自动重试',
        content: '自动重试将在直接上传失败后会尝试强制修改您的文件数据，改变文件的校验信息，以触发网易云的强制上传，此方式在测试过程中会提升上传成功率。请放心，此操作不会修改您本地磁盘上的文件信息，但有可能会导致上传到网易云的音乐无法播放，请您上传完成后自行测试，若上传后的文件无法试听则请关闭此功能。',
        onOk() {
            uploader.autoRetry = true
        },
        onCancel() {
            uploader.autoRetry = false
        }
    })
}

</script>
<template>
    <a-config-provider :locale="zhCN">

        <div v-if="user.id">
            <a-page-header title="云盘Lite"
                           :sub-title="user.name">
                <template #extra>
                    <a-switch v-model:checked="uploader.autoRetry"
                              @click="switchAutoRetry"
                              checked-children="开启"
                              un-checked-children="重试" />
                    <label for="fileInput"
                           v-if="uploader.progress == null">
                        <input id="fileInput"
                               type="file"
                               accept=".mp3,.flac,.ape,.wma,.wav,.ogg,.aac,.m4a,.mp4"
                               @change="changeFile"
                               :key="uploader.filesKey" />
                        <a-typography-text underline
                                           content="上传"
                                           style="cursor:pointer" />
                    </label>
                    <a-typography-text v-else
                                       :content="`${uploader.progress}%`" />
                </template>
            </a-page-header>
            <lite-list ref="listComponent" />
        </div>
        <login v-else />
        <a-modal title="编辑信息"
                 :visible="uploader.show"
                 @cancel="e => uploader.show = false"
                 @ok="e => upload()"
                 ok-text="确定上传">
            <a-form :label-col="{ span: 3 }"
                    :wrapper-col="{ span: 21 }">
                <a-form-item label="标题">
                    <a-input v-model:value="uploader.data.song" />
                </a-form-item>
                <a-form-item label="歌手">
                    <a-input v-model:value="uploader.data.artist" />
                </a-form-item>
                <a-form-item label="专辑">
                    <a-input v-model:value="uploader.data.album" />
                </a-form-item>
            </a-form>
        </a-modal>
    </a-config-provider>
</template>
<style>
input[type="file"] {
    display: none;
}</style>