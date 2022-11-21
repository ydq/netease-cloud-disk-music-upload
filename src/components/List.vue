<script setup>
import { inject, onMounted, reactive, watch } from 'vue'
import { cloudGet, cloudDel, songInfo, lyric, validCode } from '@/scripts/api.js'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { message, Modal } from 'ant-design-vue'
import 'ant-design-vue/es/message/style/css'
import 'ant-design-vue/es/modal/style/css'
import axios from 'axios'

dayjs.extend(relativeTime)

const cloud = reactive({
    data: [],
    offset: 0,
    limit: 30,
    loading: false,
    selectedRowKeys: [],
    progressWidth: 24,
    lrcs: null,
    currLrc: null
})

const columns = [
    { title: '播放', key: 'play', width: 45 },
    { title: '标题', dataIndex: 'songName', ellipsis: true, },
    { title: '歌手', dataIndex: 'artist', width: 200, ellipsis: true, },
    { title: '专辑', dataIndex: 'album', width: 200, ellipsis: true, },
    { title: '大小', dataIndex: 'fileSize', width: 100 },
    { title: '上传时间', dataIndex: 'addTime', width: 120 },
    { title: '下载', key: 'dl', width: 45 },
]

const checkLogin = inject('checkLogin')

/**
 * 加载网盘分页列表数据
 */
const loadData = async (pageopt, autoRetry = true) => {
    cloud.loading = true
    cloud.selectedRowKeys = []
    let resp = await cloudGet({ limit: pageopt.pageSize, offset: (pageopt.current - 1) * pageopt.pageSize })
    if (!validCode.includes(resp.code)) {
        if (autoRetry) {
            await checkLogin()
            loadData(pageopt, false)
        } else {
            message.warn('获取网盘数据失败，请稍后重试或者要不试试重新登录～')
        }
        return
    }
    cloud.data = resp.data
    pagination.total = resp.count
    pagination.current = pageopt.current
    pagination.pageSize = pageopt.pageSize
    playStatus(player.id)
    cloud.loading = false
}


/**
 * 重新初始化刷新列表
 */
const reload = async () => {
    pagination.current = 1
    cloud.selectedRowKeys = []
    await loadData(pagination)
}

/**
 * 批量删除所选音乐
 */
const delData = () => {
    Modal.confirm({
        title: '删除网盘音乐',
        content: '确定要删除当前所选的网盘音乐吗？（删除后不可恢复）',
        okText: '确认',
        cancelText: '取消',
        async onOk() {
            let resp = await cloudDel({ songIds: cloud.selectedRowKeys })
            if (validCode.includes(resp.code)) {
                await loadData(pagination)
                message.success('删除云盘指定音乐成功')
            } else {
                message.warn('删除云盘音乐失败，但重试几次没准会有奇效～')
            }
        }
    });
}

const pagination = reactive({
    size: 'normal',
    total: 0,
    hideOnSinglePage: true,
    pageSize: Math.max(5, Math.floor((document.body.offsetHeight - 250) / 40)),
    pageSizeOptions: ['10', '20', '30', '50', '100'],
    current: 1
})

const dateFmt = time => {
    let d = dayjs(time)
    if (Math.abs(d.diff(Date.now(), 'd')) > 0) {
        return d.format('YYYY-MM-DD')
    }
    return d.fromNow()
}

const player = inject('player')

const play = async item => {
    if (player.id != item.songId) {
        let resp = await songInfo({ ids: [item.songId] })
        if (validCode.includes(resp.code)) {
            getLyric(item.songId)
            player.play(item.songId, resp.data[0].url)
        } else {
            message.warn("获取链接地址失败，但重试几次没准会有奇效～")
        }
    } else {
        player.stop()
    }
}


const getLyric = async id => {
    let resp = await lyric({ id })
    if (resp.lrc && resp.lrc.lyric) {
        let lrcs = {}
        resp.lrc.lyric.split('\n').forEach(line => {
            let lrcTxt = /(?:\[\d+:\d+\.\d+\])+(.*)/g.exec(line);
            lrcTxt && line.match(/\[\d+:\d+.\d+\]/g).forEach(time => {
                let t = /\[(\d+):(\d+)\.(\d+)\]/.exec(time);
                lrcs[60 * t[1] + 1 * t[2]] = lrcTxt[1];
            });
        });
        cloud.lrcs = lrcs
    }
}

const playStatus = id => {
    cloud.data.forEach(item => {
        if (item.songId == id) {
            item.percent = player.percent
            item.playing = true
        } else {
            item.percent = 0
            item.playing = false
        }
    })
}

/**
 * 切歌 清空原歌词 刷新播放按钮状态
 */
watch(() => player.id, id => {
    cloud.lrcs = null
    cloud.currLrc = null
    playStatus(id)
})

/**
 * 刷新播放进度 和 歌词
 */
watch(() => player.percent, percent => {
    cloud.data
        .filter(item => item.songId == player.id)
        .forEach(item => item.percent = percent)
    if (cloud.lrcs) {
        let curr = cloud.lrcs[player.currSec]
        if (curr) {
            cloud.currLrc = curr
        }
    }
})

/**
 * 批量下载
 */
const batchDownload = () => {
    if (cloud.selectedRowKeys.length) {
        download(cloud.data.filter(item => cloud.selectedRowKeys.includes(item.songId)))
    }
}


const download = async items => {
    let map = {}
    for (let item of items) {
        if (item.dlPercent == null) {
            map[item.songId] = item
        }
    }
    let ids = Object.keys(map)
    if (ids.length) {
        let resp = await songInfo({ ids: ids, level: 'hires' })
        if (validCode.includes(resp.code)) {
            for (let song of resp.data) {
                let item = map[song.id]
                let dlResp = await axios.get(song.url, {
                    responseType: 'blob',
                    onDownloadProgress(e) {
                        item.dlPercent = Math.floor(e.progress * 100)
                    }
                })
                const blob = new Blob([dlResp.data]);
                const fileName = `${item.songName}-${item.artist}.${(song.type || song.encodeType).toLowerCase()}`;
                const elink = document.createElement('a');
                elink.download = fileName;
                elink.style.display = 'none';
                elink.href = URL.createObjectURL(blob);
                document.body.appendChild(elink);
                elink.click();
                URL.revokeObjectURL(elink.href);
                document.body.removeChild(elink);

            }
        } else {
            message.warn('获取链接地址失败，但重试几次没准会有奇效～')
        }
    }
}

onMounted(reload)
</script>
<template>
    <a-table class="ant-table-hover-pointer"
        size="small"
        :dataSource="cloud.data"
        :columns="columns"
        :loading="cloud.loading"
        :pagination="pagination"
        row-key="songId"
        :row-selection="{
            selectedRowKeys: cloud.selectedRowKeys,
            onChange(keys) { cloud.selectedRowKeys = keys }
        }"
        :custom-row="record => {
            return {
                onClick: () => {
                    if (cloud.selectedRowKeys.includes(record.songId)) {
                        cloud.selectedRowKeys.splice(cloud.selectedRowKeys.indexOf(record.songId), 1);
                    } else {
                        cloud.selectedRowKeys.push(record.songId);
                    }
                },
            }
        }"
        @change="loadData">
        <template #title>
            <a-row type="flex">
                <a-col flex="300px">
                    <a-space>
                        <a-tooltip title="重新加载">
                            <a-button size="small"
                                @click="reload()">
                                ◎
                            </a-button>
                        </a-tooltip>
                        <a-tooltip title="批量删除">
                            <a-button size="small"
                                :disabled="!cloud.selectedRowKeys.length"
                                @click="delData()">
                                &times;
                            </a-button>
                        </a-tooltip>
                        <a-tooltip title="批量下载">
                            <a-button size="small"
                                :disabled="!cloud.selectedRowKeys.length"
                                @click="batchDownload()">
                                ↓
                            </a-button>
                        </a-tooltip>
                        <span v-if="cloud.selectedRowKeys.length">
                            {{ `已选择 ${cloud.selectedRowKeys.length} 项` }}
                        </span>
                    </a-space>
                </a-col>
                <a-col flex="auto">
                    <div style="position: relative;text-align: right;">
                        <Transition>
                            <div :key="cloud.currLrc || 'noneLrc'">
                                <a-typography-text type="secondary">{{ cloud.currLrc }}</a-typography-text>
                            </div>
                        </Transition>
                    </div>
                </a-col>
            </a-row>


        </template>

        <template #bodyCell="{ column, record }">
            <template v-if="column.key == 'play'">
                <a-progress @click.stop="play(record)"
                    type="circle"
                    :percent="record.playing && record.percent || 0"
                    :width="cloud.progressWidth"
                    trailColor="#ddd">
                    <template #format>
                        <i class="icn"
                            :class="record.playing ? 'stop' : 'play'"></i>
                    </template>
                </a-progress>
            </template>
            <template v-else-if="column.dataIndex == 'songName'">
                <a-tooltip :title="record.songName">
                    {{ record.songName }}
                </a-tooltip>
            </template>
            <template v-else-if="column.dataIndex == 'artist'">
                <a-tooltip :title="record.artist">
                    {{ record.artist }}
                </a-tooltip>
            </template>
            <template v-else-if="column.dataIndex == 'album'">
                <a-tooltip :title="record.album">
                    {{ record.album }}
                </a-tooltip>
            </template>
            <template v-else-if="column.dataIndex == 'fileSize'">
                {{ (record.fileSize / 1024 / 1024).toFixed(1) }} MB
            </template>
            <template v-else-if="column.dataIndex == 'addTime'">
                {{ dateFmt(record.addTime) }}
            </template>
            <template v-else-if="column.key == 'dl'">
                <a-progress @click.stop="download([record])"
                    type="circle"
                    :percent="record.dlPercent || 0"
                    :width="cloud.progressWidth"
                    trailColor="#ddd">
                    <template #format="percent">
                        <span v-if="percent == 0">↓</span>
                        <span v-else-if="percent < 100">{{ percent }}</span>
                        <span v-else>✓</span>
                    </template>
                </a-progress>
            </template>
        </template>
    </a-table>
</template>
<style>
.ant-table-hover-pointer .ant-table-row {
    cursor: pointer;
}

.v-enter-active,
.v-leave-active {
    transition: all .5s ease;
}

.v-enter-from,
.v-leave-to {
    position: absolute;
    right: 0;
    opacity: 0;
}

.v-enter-from {
    transform: translateX(20px);
}

.v-leave-to {
    transform: translateX(-20px);
}
</style>