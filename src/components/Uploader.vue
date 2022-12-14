<script setup>
import { ArrayBuffer as MD5 } from 'spark-md5'
import { parseBuffer as metaData } from 'music-metadata'
import { Buffer } from 'buffer'
import { inject, reactive, watch } from 'vue'
import { uploadCheck, uploadToken, uploadFile, cloudInfo, cloudPub, validCode } from '@/scripts/api.js'
import { message } from 'ant-design-vue'
import 'ant-design-vue/es/message/style/css'

window.Buffer = Buffer;

const uploader = reactive({
    files: [],
    filesKey: Date.now(),
    drag: false,
    progressWidth: 24,
    chunkSize: 2097152,//2M = 1024*2048
})

const editableData = reactive({})

/**
 * input[type="file"]选择文件的处理
 */
const changeFile = e => {
    addFiles(e.target.files)
    //销毁重建input标签，允许选择同一个文件
    uploader.filesKey = Date.now()
}

/**
 * 拖放文件
 */
const dropFile = e => {
    uploader.drag = false
    addFiles(e.dataTransfer.files)
}

/**
 * 将文件追加到上传列表
 */
const addFiles = files => {
    [...files].filter(file => file.type.startsWith('audio/'))
        .filter(file => !uploader.files.map(i => i.filename).includes(file.name))
        .forEach(async file => {
            let ext = file.name.match(/\.(?<ext>\w+)$/).groups.ext.toUpperCase()
            let tag = null;
            try {
                let meta = await metaData(Buffer.from(await file.arrayBuffer()), file.type)
                if (meta && meta.common) {
                    tag = meta.common
                }
            } catch (e) {
                message.info(`解析【${file.name}】的 元数据 信息失败`)
            }
            let item = {
                filename: file.name,
                song: tag && tag.title || file.name,
                artist: tag && tag.artist || '',
                album: tag && tag.album || '',
                file,
                ext
            }
            uploader.files.push(item)
        })
    playStatus(player.id)
}


const file2ArrayBuffer = file => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = e => resolve(e.target.result)
        reader.onerror = reject
        reader.readAsArrayBuffer(file)
    })
}

/**
 * 上传列表中的指定文件
 */
const upload = async (i, autoRetry = true) => {
    const data = uploader.files[i]
    //初始化一个进度条，防止频繁点击
    data.percent = 0

    const md5 = MD5.hash(await file2ArrayBuffer(data.file))
    const ext = data.ext
    const filename = data.filename
        .replace('.' + ext, '')
        .replace(/\s/g, '')
        .replace(/\./g, '_')

    let checkResp = await uploadCheck({ md5, length: data.file.size })

    let failSuffix = '失败了，但手动重试几次没准会有奇效～'
    let retryMsg = '上传发生了一点问题，正在自动重试...'

    if (!validCode.includes(checkResp.code)) {
        data.percent = null
        if (autoRetry) {
            message.info(retryMsg)
            upload(i, false)
        } else {
            message.warn(`上传前置检查${failSuffix}`)
        }
        return
    }

    let tokenResp = await uploadToken({ ext, md5, filename })

    if (!validCode.includes(tokenResp.code)) {
        data.percent = null
        if (autoRetry) {
            message.info(retryMsg)
            upload(i, false)
        } else {
            message.warn(`获取上传Token${failSuffix}`)
        }
        return
    }

    if (checkResp && checkResp.needUpload) {
        try {
            await uploadFile({
                file: data.file,
                md5,
                objectKey: tokenResp.result.objectKey,
                token: tokenResp.result.token
            }, e => {
                data.percent = e.progress == 1 ? 99 : Math.floor(e.progress * 100)
            })
        } catch (e) {
            data.percent = null
            if (autoRetry) {
                message.info(retryMsg)
                upload(i, false)
            } else {
                message.warn(`文件上传${failSuffix}`)
            }
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
        data.percent = null
        if (autoRetry) {
            message.info(retryMsg)
            upload(i, false)
        } else {
            message.warn(`更新文件信息${failSuffix}`)
        }
        return
    }

    let resp = await cloudPub({ songid: infoResp.songId })

    if (validCode.includes(resp.code)) {
        message.success(`${data.filename}上传成功`)
        data.percent = 100
    } else {
        data.percent = null
        if (autoRetry) {
            message.info(retryMsg)
            upload(i, false)
        } else {
            message.warn(`保存到网盘${failSuffix}`)
        }
    }
}


/**
 * 编辑指定文件的信息
 */
const edit = filename => {
    editableData[filename] = Object.assign({}, uploader.files.filter(item => filename == item.filename)[0])
}

/**
 * 保存编辑指定文件的信息
 */
const save = filename => {
    Object.assign(uploader.files.filter(item => filename == item.filename)[0], editableData[filename])
    delete editableData[filename]
}

/**
 * 取消编辑指定文件的信息
 */
const cancel = filename => {
    delete editableData[filename];
}

const columns = [
    { title: '播放', key: 'play', width: 45 },
    { title: '标题', dataIndex: 'song', ellipsis: true, },
    { title: '歌手', dataIndex: 'artist', ellipsis: true, },
    { title: '专辑', dataIndex: 'album', ellipsis: true, },
    { title: '格式', dataIndex: 'ext', ellipsis: true, width: 80 },
    { title: '大小', key: 'size', ellipsis: true, width: 100 },
    { title: '操作', key: 'ops', ellipsis: true, width: 140, }
]

const progressColor = { '0%': '#108ee9', '100%': '#87d068', }


const player = inject('player')

const play = item => {
    if (player.id != item.filename) {
        player.play(item.filename, URL.createObjectURL(item.file))
    } else {
        player.stop(true)
    }
}

const playStatus = id => {
    uploader.files.forEach(item => {
        if (item.filename == id) {
            item.playPercent = player.percent
            item.playing = true
        } else {
            item.playPercent = 0
            item.playing = false
        }
    })
}

watch(() => player.id, id => playStatus(id))
watch(() => player.percent, percent => {
    uploader.files
        .filter(item => item.filename == player.id)
        .forEach(item => item.playPercent = percent)
})


</script>
<template>
    <div class="drop-container"
        :class="{ draging: uploader.drag }"
        @drop.prevent="dropFile"
        @dragover.prevent="uploader.drag = true"
        @dragenter="uploader.drag = true"
        @dragleave="uploader.drag = false">

        <a-table size="small"
            row-key="filename"
            :pagination="false"
            :dataSource="uploader.files"
            :columns="columns">
            <template #title>

                <label for="fileInput">
                    <a-tooltip title="选择文件">
                        <span class="ant-btn ant-btn-sm">+</span>
                    </a-tooltip>

                    <input id="fileInput"
                        type="file"
                        accept=".mp3,.flac,.ape,.wma,.wav,.ogg,.aac"
                        multiple
                        @change="changeFile"
                        :key="uploader.filesKey" />

                    <a-typography-text type="secondary">
                        点此 <b>选择文件</b>（支持多选） 或者 将 <b>文件往拖放</b> 至下方区域以添加至上传列表
                    </a-typography-text>
                </label>

            </template>
            <template #bodyCell="{ column, record, text, index }">
                <template v-if="column.key == 'play'">
                    <a-progress @click.stop="play(record)"
                        type="circle"
                        :percent="record.playing && record.playPercent || 0"
                        :width="uploader.progressWidth"
                        trailColor="#ddd">
                        <template #format>
                            <i class="icn"
                                :class="record.playing ? 'stop' : 'play'"></i>
                        </template>
                    </a-progress>
                </template>
                <template v-else-if="column.key == 'size'">
                    {{ (record.file.size / 1024 / 1024).toFixed(1) }} MB
                </template>
                <template v-else-if="['song', 'artist', 'album'].includes(column.dataIndex)">
                    <a-input v-if="editableData[record.filename]"
                        size="small"
                        v-model:value="editableData[record.filename][column.dataIndex]" />
                    <template v-else>
                        {{ text }}
                    </template>
                </template>
                <template v-else-if="column.key == 'ops'">
                    <a-space v-if="record.percent == null">
                        <template v-if="editableData[record.filename]">
                            <a-tooltip title="保存信息"
                                key="tp-save"
                                :mouseLeaveDelay="0">
                                <a-button size="small"
                                    @click="save(record.filename)">✓</a-button>
                            </a-tooltip>

                            <a-popconfirm title="确定取消吗？"
                                @confirm="cancel(record.filename)">
                                <a-tooltip title="取消保存"
                                    placement="right"
                                    key="tp-cancel"
                                    :mouseLeaveDelay="0">
                                    <a-button size="small">&times;</a-button>
                                </a-tooltip>
                            </a-popconfirm>
                        </template>
                        <template v-else>
                            <a-tooltip title="编辑信息"
                                key="tp-edit"
                                :mouseLeaveDelay="0">
                                <a-button size="small"
                                    @click="edit(record.filename)">#</a-button>
                            </a-tooltip>

                            <a-tooltip title="上传音乐"
                                key="tp-upload"
                                :mouseLeaveDelay="0">
                                <a-button size="small"
                                    @click="upload(index)">↑</a-button>
                            </a-tooltip>
                            <a-tooltip title="移除列表"
                                key="tp-remove"
                                :mouseLeaveDelay="0">
                                <a-button size="small"
                                    @click="uploader.files.splice(index, 1)">&times;</a-button>
                            </a-tooltip>
                        </template>
                    </a-space>
                    <a-progress v-else
                        :percent="record.percent"
                        :status="record.percent == 100 ? 'success' : 'active'"
                        :stroke-color="progressColor"
                        size="small" />
                </template>
            </template>
        </a-table>
    </div>
</template>
<style>
.drop-container {
    position: relative;
    overflow: hidden;
    min-height: calc(100vh - 150px);
}

@keyframes dragBorderAni {
    100% {
        background-position: 10px 0, -10px 100%, 0 -10px, 100% 10px
    }
}

.drop-container.draging::after {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    width: 100%;
    height: 100%;
    z-index: 1;
    pointer-events: none;
    background: linear-gradient(90deg, #1890ff 50%, transparent 0) repeat-x,
        linear-gradient(90deg, #1890ff 50%, transparent 0) repeat-x,
        linear-gradient(0deg, #1890ff 50%, transparent 0) repeat-y,
        linear-gradient(0deg, #1890ff 50%, transparent 0) repeat-y;
    background-size: 10px 2px, 10px 2px, 2px 10px, 2px 10px;
    background-position: 0 0, 0 100%, 0 0, 100% 0;
    animation: dragBorderAni .2s infinite linear;
}

label[for="fileInput"] {
    display: block;
    cursor: pointer;
    overflow: hidden;
}

#fileInput {
    display: none;
}
</style>