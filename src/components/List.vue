<script setup>
import { inject, onMounted, reactive, watch } from 'vue'
import { cloudGet, cloudDel, songInfo, lyric, songMatch, validCode } from '@/js/api.js'
import { checkLogin } from '@/js/users.js'
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
    { title: '下载', key: 'dl', width: 45 },
    { title: '标题', dataIndex: 'songName', width: 200, ellipsis: true, },
    { title: '歌手', dataIndex: 'artist', width: 200, ellipsis: true, },
    { title: '专辑', dataIndex: 'album', width: 200, ellipsis: true, },
    { title: '大小', dataIndex: 'fileSize', width: 100 },
    { title: '上传时间', dataIndex: 'addTime', width: 120 },
    { title: '操作', key: 'ops', width: 45 },
]


const pagination = reactive({
    size: 'normal',
    total: 0,
    hideOnSinglePage: true,
    pageSize: Math.max(5, Math.floor((document.body.offsetHeight - 250) / 44)),
    pageSizeOptions: ['10', '20', '30', '50', '100'],
    current: 1
})

const player = inject('player')
const user = inject('user')

/**
 * 加载网盘分页列表数据
 */
const loadData = async (pageopt, autoRetry = true) => {
    cloud.loading = true
    cloud.selectedRowKeys = []
    let resp = await cloudGet({ limit: pageopt.pageSize, offset: (pageopt.current - 1) * pageopt.pageSize })
    if (!validCode.includes(resp.code)) {
        if (autoRetry) {
            await checkLogin(user)
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
                message.warn('删除云盘音乐失败，但重试几次或换个时间段再试没准会有奇效～')
            }
        }
    });
}

const dateFmt = time => {
    let d = dayjs(time)
    if (Math.abs(d.diff(Date.now(), 'd')) > 0) {
        return d.format('YYYY-MM-DD')
    }
    return d.fromNow()
}


const play = async item => {
    if (player.id != item.songId) {
        let resp = await songInfo({ ids: [item.songId] })
        if (validCode.includes(resp.code)) {
            getLyric(item.songId)
            player.play(item.songId, resp.data[0].url, item.simpleSong.al.picUrl)
        } else {
            message.warn("获取链接地址失败，但重试几次或换个时间段再试没准会有奇效～")
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


watch(()=>user.id,id=> reload())

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
                //cloud.selectedRowKeys.splice(cloud.selectedRowKeys.indexOf(song.id), 1)
            }
        } else {
            message.warn('获取链接地址失败，但重试几次或换个时间段再试没准会有奇效～')
        }
    }
}

const match = async record => {
    if (!record.asid) {
        message.info('您还没有输入任何内容，若想清空已有的匹配请输入0')
        return
    }
    record.asid = record.asid.trim()
    let urlmatch = record.asid.match(/music\.163\.com\/(?<type>\w+).*[?&]id=(?<asid>\d+)/)
    if (urlmatch) {
        if (urlmatch.groups.type == 'song') {
            record.asid = urlmatch.groups.asid
        }
    }
    if (!/^\d+$/.test(record.asid)) {
        message.warn('您输入的可能不是一个合法的ID或者网易云音乐的歌曲链接，请检查～')
        return;
    }
    if (record.asid == record.songId) {
        message.info('当前歌曲已经是您填写的匹配信息了，若要取消匹配请输入0')
        return
    }
    let oldId = record.songId
    let resp = await songMatch({ userId: user.id, adjustSongId: record.asid, songId: record.songId })
    if (validCode.includes(resp.code)) {
        message.success('歌曲信息已匹配纠正～')
        Object.assign(record, resp.matchData)
        delete record.asid
        let newId = record.songId
        //因为歌曲信息匹配修改之后，网盘内的歌曲ID变成了你输入的歌曲ID
        //所以 如果播放器播放的是当前老的ID，则需要进行更新
        if (player.id == oldId) {
            player.id = newId
            player.cover = record.simpleSong.al.picUrl
            getLyric(newId)//自动触发根据新的歌曲ID重新获取歌词
        }
        if (cloud.selectedRowKeys.includes(oldId)) {
            cloud.selectedRowKeys.splice(cloud.selectedRowKeys.indexOf(oldId), 1);
            cloud.selectedRowKeys.push(newId);
        }
    } else {
        message.warn(resp.message)
    }
}

onMounted(reload)
</script>
<template>
    <a-table class="ant-table-hover-pointer"
             size="small"
             row-key="songId"
             :data-source="cloud.data"
             :columns="columns"
             :loading="cloud.loading"
             :pagination="pagination"
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
            <template v-if="column.key == 'dl'">
                <a-tooltip title="下载"
                           placement="top">
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
                </a-tooltip>
            </template>
            <template v-else-if="column.dataIndex == 'songName'">
                <a-space size="small">
                    <a-popover :title="'点击' + (record.playing ? '停止播放' : '播放当前音乐')"
                               placement="topLeft"
                               arrow-point-at-center>
                        <template #content>
                            <a-row type="flex"
                                   :gutter="10">
                                <a-col :flex="1"><img :src='record.simpleSong.al.picUrl'
                                         width="120" /></a-col>
                                <a-col :flex="auto">
                                    <a-list size="small">
                                        <a-list-item>标题：{{ record.simpleSong.name || record.songName }}</a-list-item>
                                        <a-list-item v-if="record.simpleSong?.ar?.[0]?.name || record.artist">歌手：{{ record.simpleSong?.ar?.[0]?.name || record.artist }}</a-list-item>
                                        <a-list-item v-if="record.simpleSong.al.name || record.album">专辑：{{ record.simpleSong.al.name || record.album }}</a-list-item>
                                    </a-list>
                                </a-col>
                            </a-row>

                        </template>
                        <a-progress @click.stop="play(record)"
                                    type="circle"
                                    :percent="record.playing && record.percent || 0"
                                    :width="cloud.progressWidth"
                                    :class="{ playing: record.playing }"
                                    trailColor="#ddd">
                            <template #format>
                                <a-avatar :size="20"
                                          :src='record.simpleSong.al.picUrl'></a-avatar>
                            </template>
                        </a-progress>
                    </a-popover>
                    <a-tooltip :title="record.simpleSong.name || record.songName">
                        {{ record.simpleSong.name || record.songName }}
                    </a-tooltip>
                </a-space>
            </template>
            <template v-else-if="column.dataIndex == 'artist'">
                <a-tooltip :title="record.simpleSong?.ar?.[0]?.name || record.artist">
                    {{ record.simpleSong?.ar?.[0]?.name || record.artist }}
                </a-tooltip>
            </template>
            <template v-else-if="column.dataIndex == 'album'">
                <a-tooltip :title="record.simpleSong.al.name || record.album">
                    {{ record.simpleSong.al.name || record.album }}
                </a-tooltip>
            </template>
            <template v-else-if="column.dataIndex == 'fileSize'">
                {{ (record.fileSize / 1024 / 1024).toFixed(1) }} MB
            </template>
            <template v-else-if="column.dataIndex == 'addTime'">
                {{ dateFmt(record.addTime) }}
            </template>
            <template v-else-if="column.key == 'ops'">
                <a-space size="small">
                    <a-popover placement="left">
                        <template #title>
                            歌曲信息匹配纠正
                            <a-tooltip mouseLeaveDelay="0"
                                       title="利用网易云音乐中已有的歌曲信息替换网盘中的歌曲信息，以便能获取歌词、图片等信息，网盘音乐播放和下载时的音乐文件还是原来上传的文件，若想取消替换，输入0即可">
                                <span style="cursor: pointer;">❓</span>
                            </a-tooltip>
                        </template>
                        <template #content>
                            <div class="match-edit">
                                <a-input-group compact>
                                    <a-input size="small"
                                             v-model:value="record.asid"
                                             placeholder="输入ID或者链接按回车"
                                             @keyup.enter="match(record)"></a-input>
                                    <a-button size="small"
                                              @click.stop="match(record)">✓</a-button>
                                </a-input-group>
                            </div>
                        </template>
                        <a-button size="small"
                                  icon="@"
                                  @click.stop></a-button>
                    </a-popover>
                </a-space>
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

.match-edit .ant-input-group-compact {
    display: flex;
}

.ant-progress.playing {
    border-radius: 50%;
    animation: wave 1s linear infinite;
}

@keyframes wave {
    0% {
        box-shadow: 0 0 0 0px #fff, 0 0 0 0px rgba(255, 0, 0, 0), 0 0 0 2px #fff, 0 0 0 3px red;
    }

    100% {
        box-shadow: 0 0 0 2px #fff, 0 0 0 3px red, 0 0 0 5px #fff, 0 0 0 6px rgba(255, 0, 0, 0);
    }
}</style>