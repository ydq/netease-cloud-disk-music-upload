<route lang="json">{
    "name": "uploader",
    "path": "/uploader"
}</route>
<script setup>
import { parseBuffer as metaData } from 'music-metadata'
import { Buffer } from 'buffer'
import { computed, inject, reactive, watch } from 'vue'
import { uploadCheck, uploadToken, uploadFile, cloudInfo, cloudPub, validCode } from '/src/js/api'
import { calcFileMd5 } from '/src/js/helper'
import { message } from 'ant-design-vue'

window.Buffer = Buffer

//从 localStorage 中读取配置
let localSetting = localStorage['uploader_setting']

const uploader = reactive({
    files: [],
    filesKey: Date.now(),
    sorter: null,
    sortFiles: computed(() => {
        if (!uploader.sorter?.order) {
            return uploader.files
        }
        let { field, columnKey, order } = uploader.sorter
        let sorter = columns.find(c => c.key == columnKey && c.dataIndex == field).sorter
        return [...uploader.files].sort((a, b) => {
            if (order == 'ascend') {
                return sorter(a, b)
            } else {
                return sorter(b, a)
            }
        })
    }),
    drag: false,
    progressWidth: 24,
    settings: {
        show: false,
        autoRetry: (localSetting & 1) == 1,
        autoClean: (localSetting & 2) == 2,
        useFileName: (localSetting & 4) == 4,
    }
})

watch(() => uploader.settings.show, show => {
    if (!show) {
        //当设置浮层关闭的时候 将配置保存到 localStorage 中
        let cfg = 0, set = uploader.settings
        set.autoRetry && (cfg |= 1)
        set.autoClean && (cfg |= 2)
        set.useFileName && (cfg |= 4)
        localStorage['uploader_setting'] = cfg
    }
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
    [...files].filter(file => {
        return file.type.toLowerCase().startsWith('audio/')
            || file.type.toLowerCase().endsWith('/x-ms-wma') // video/x-ms-wma
            || file.type.toLowerCase().endsWith('/mp4')
            || file.name.toLowerCase().endsWith('.ape')
    })
        .filter(file => !uploader.files.map(i => i.filename).includes(file.name))
        .forEach(async file => {
            let ext = file.name.match(/\.(?<ext>\w+)$/).groups.ext.toUpperCase()
            let tag = null
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
                song: uploader.settings.useFileName ? file.name.replace(/^(.*)\.\w+$/, '$1') : (tag && tag.title || file.name),
                artist: tag && tag.artist || '',
                album: tag && tag.album || '',
                file,
                ext
            }
            uploader.files.push(item)
        })
    playStatus(player.id)
}



/**
 * 批量上传全部未上传的文件
 */
const uploadAll = async () => {
    let datas = uploader.sortFiles.filter(data => data.percent == null)
    if (datas.length == 0) {
        message.info('列表中似乎没有需要上传的项目')
    }
    for (let data of datas) {
        await upload(data)
    }

}

/**
 * 上传列表中的指定文件
 */
const upload = async (data, isRetry = false) => {
    //初始化一个进度条，防止频繁点击
    data.percent = 0

    const md5 = await calcFileMd5(data.file, isRetry)
    const ext = data.ext
    const filename = data.filename
        .replace('.' + ext, '')
        .replace(/\s/g, '')
        .replace(/\./g, '_')

    let checkResp = await uploadCheck({ md5, length: data.file.size })

    if (!validCode.includes(checkResp.code)) {
        await fail(data, '上传前置检查', isRetry)
        return
    }

    let tokenResp = await uploadToken({ ext, md5, filename })

    if (!validCode.includes(tokenResp.code)) {
        await fail(data, '获取上传Token', isRetry)
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
                //上传进度完成不能表示真正的完成，后面还有接口需要调用
                data.percent = e.progress == 1 ? 99 : Math.floor(e.progress * 100)
            })
        } catch (e) {
            await fail(data, '文件上传', isRetry)
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
        await fail(data, '更新文件信息', isRetry)
        return
    }

    let resp = await cloudPub({ songid: infoResp.songId })

    if (validCode.includes(resp.code)) {
        message.success(`${data.filename}上传成功`)
        if (uploader.settings.autoClean) {
            uploader.files.splice(uploader.files.findIndex(item => data == item), 1)
        } else {
            data.percent = 100
        }
    } else {
        await fail(data, '保存到网盘', isRetry)
    }
}


const fail = async (data, ops, isRetry) => {
    data.percent = null
    if (uploader.settings.autoRetry) {
        if (isRetry) {
            message.warn(`${ops}失败了，但手动重试几次或换个时间段再试没准会有奇效～`)
        } else {
            message.info('上传发生了一点问题，正在自动重试...')
            await upload(data, true)
        }
    } else {
        message.warn(`${ops}失败了，试试自动上传没准会有奇效～`)
    }
}

/**
 * 编辑指定文件的信息
 */
const edit = filename => {
    editableData[filename] = Object.assign({}, uploader.files.find(item => filename == item.filename))
}

/**
 * 保存编辑指定文件的信息
 */
const save = filename => {
    Object.assign(uploader.files.find(item => filename == item.filename), editableData[filename])
    delete editableData[filename]
}

/**
 * 取消编辑指定文件的信息
 */
const cancel = filename => {
    delete editableData[filename]
}

const columns = [
    { title: '标题', dataIndex: 'song', ellipsis: true, sorter: (a, b) => a.filename.localeCompare(b.filename, 'en') },
    { title: '歌手', dataIndex: 'artist', ellipsis: true, sorter: (a, b) => a.artist.localeCompare(b.artist, 'en') },
    { title: '专辑', dataIndex: 'album', ellipsis: true, sorter: (a, b) => a.album.localeCompare(b.album, 'en') },
    { title: '格式', dataIndex: 'ext', ellipsis: true, width: 80 },
    { title: '大小', key: 'size', ellipsis: true, width: 100, sorter: (a, b) => a.file.size - b.file.size },
    { title: '操作', key: 'ops', ellipsis: true, width: 140, }
]

const progressColor = { '0%': '#108ee9', '100%': '#87d068', }


const player = inject('player')
const user = inject('user')

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
//切换账号后 将上传列表置空
watch(() => user.id, id => uploader.files = [])


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
                 :columns="columns"
                 @change="(page, filter, sorter) => uploader.sorter = sorter">
            <template #emptyText>
                <div style="padding: 130px 0;">当前暂无内容<br>您可以直接拖放文件在此处以添加到上传列表哦<br>上传期间请勿切换账号，否则可能导致不可预料的后果</div>
            </template>
            <template #title>

                <a-space>

                    <a-tooltip title="全部上传">
                        <a-button size="small"
                                  @click="uploadAll"
                                  :disabled="uploader.files.length == 0">
                            <i class="icon icon-upload"></i>
                        </a-button>
                    </a-tooltip>

                    <a-dropdown placement="bottomLeft"
                                v-model:open="uploader.settings.show">
                        <a-button size="small">
                            <i class="icon icon-setting"></i>
                        </a-button>
                        <template #overlay>
                            <a-menu>
                                <a-tooltip placement="right"
                                           :overlayStyle="{ 'max-width': '340px' }">
                                    <template #title>
                                        请注意：自动重试将在直接上传失败后会<u>尝试强制修改您的文件数据，改变文件的校验信息，以触发网易云的强制上传</u>，此方式在测试过程中会提升上传成功率。请放心，此操作不会修改您本地磁盘上的文件信息，但有可能会导致上传到网易云的音乐无法播放，请您上传完成后自行测试，若上传后的文件无法试听则请关闭此功能。
                                    </template>
                                    <a-badge-ribbon text="注意"
                                                    color="red">
                                        <a-menu-item key="1">
                                            <a-checkbox v-model:checked="uploader.settings.autoRetry">自动重试</a-checkbox>
                                        </a-menu-item>
                                    </a-badge-ribbon>
                                </a-tooltip>
                                <a-menu-item key="2">
                                    <a-checkbox v-model:checked="uploader.settings.autoClean">上传成功自动移除</a-checkbox>
                                </a-menu-item>
                                <a-tooltip placement="right"
                                           title="使用文件名作为标题，防止自动解析因编码问题造成的乱码，仅对新添加的文件生效，已经添加的文件不会生效">
                                    <a-menu-item key="3">
                                        <a-checkbox v-model:checked="uploader.settings.useFileName">文件名作为标题</a-checkbox>
                                    </a-menu-item>
                                </a-tooltip>
                            </a-menu>
                        </template>
                    </a-dropdown>
                    <label for="fileInput">
                        <input id="fileInput"
                               type="file"
                               accept=".mp3,.flac,.ape,.wma,.wav,.ogg,.aac,.m4a,.mp4"
                               multiple
                               @change="changeFile"
                               :key="uploader.filesKey" />

                        <a-typography-text type="secondary">
                            <a-tooltip title="选择文件"
                                       placement="bottomLeft">
                                <span style="text-decoration: underline;">点此 <b>选择文件</b>（支持多选）</span>
                            </a-tooltip>
                        </a-typography-text>
                    </label>
                </a-space>

            </template>
            <template #bodyCell="{ column, record, text, index }">
                <template v-if="column.key == 'size'">
                    {{ (record.file.size / 1024 / 1024).toFixed(1) }} MB
                </template>
                <template v-else-if="column.dataIndex == 'song'">
                    <a-space size="small">
                        <a-progress @click.stop="play(record)"
                                    type="circle"
                                    :percent="record.playing && record.playPercent || 0"
                                    :size="uploader.progressWidth">
                            <template #format>
                                <i class="icn"
                                   :class="record.playing ? 'stop' : 'play'"></i>
                            </template>
                        </a-progress>
                        <a-input v-if="editableData[record.filename]"
                                 size="small"
                                 v-model:value="editableData[record.filename][column.dataIndex]" />
                        <template v-else>
                            {{ text }}
                        </template>
                    </a-space>
                </template>
                <template v-else-if="['artist', 'album'].includes(column.dataIndex)">
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
                                          @click="save(record.filename)">
                                    <i class="icon icon-ok"></i>
                                </a-button>
                            </a-tooltip>

                            <a-popconfirm title="确定取消吗？"
                                          @confirm="cancel(record.filename)">
                                <a-tooltip title="取消保存"
                                           placement="right"
                                           key="tp-cancel"
                                           :mouseLeaveDelay="0">
                                    <a-button size="small">
                                        <i class="icon icon-back"></i>
                                    </a-button>
                                </a-tooltip>
                            </a-popconfirm>
                        </template>
                        <template v-else>
                            <a-tooltip title="编辑信息"
                                       key="tp-edit"
                                       :mouseLeaveDelay="0">
                                <a-button size="small"
                                          @click="edit(record.filename)">
                                    <i class="icon icon-edit"></i>
                                </a-button>
                            </a-tooltip>

                            <a-tooltip title="上传音乐"
                                       key="tp-upload"
                                       :mouseLeaveDelay="0">
                                <a-button size="small"
                                          @click="upload(record)">
                                    <i class="icon icon-upload"></i>
                                </a-button>
                            </a-tooltip>
                            <a-tooltip title="移除列表"
                                       key="tp-remove"
                                       :mouseLeaveDelay="0">
                                <a-button size="small"
                                          @click="uploader.files.splice(uploader.files.findIndex(item => item == record), 1)">
                                    <i class="icon icon-delete"></i>
                                </a-button>
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
.icn.play {
    width: 0;
    vertical-align: bottom;
    border-left-width: 8px;
    border-left-color: currentColor;
    transform: translate(4px, 0px);
}

.icn.stop {
    width: 10px;
    height: 10px;
    border-width: 2px;
    border-color: currentColor;
}

.drop-container {
    position: relative;
    overflow: hidden;
    min-height: calc(100vh - 120px);
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
    display: inline-block;
    cursor: pointer;
    overflow: hidden;
    vertical-align: top;
}

#fileInput {
    display: none;
}
</style>