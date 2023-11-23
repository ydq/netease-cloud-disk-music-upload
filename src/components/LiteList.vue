<script setup>
import { computed, inject, onMounted, reactive } from 'vue'
import { cloudGet, cloudDel, songInfo, songMatch, validCode } from '/src/js/api.js'
import { checkLogin } from '/src/js/users.js'
import { filterList } from '/src/js/helper.js'
import { message, Modal } from 'ant-design-vue'
import axios from 'axios'


const cloud = reactive({
    allData: [],//完整的原始数据
    filter: '',//本地搜索过滤
    data: computed(() => {
        //给到table 的数据
        cloud.loading = true
        let data = filterList(cloud.allData, cloud.filter.replace(/\s+/ig, '').toLowerCase())
        cloud.loading = false
        pagination.total = data.length
        return data;
    }),
    loading: false,
})


const pagination = reactive({
    size: 'normal',
    simple: true,
    total: 0,
    hideOnSinglePage: true,
    pageSize: Math.max(3, Math.floor((document.body.offsetHeight - 165) / 113)),
    onChange(page) {
        pagination.current = page
        Object.assign(pagination, page)
    }
})

const user = inject('user')

/**
 * 加载网盘分页列表数据
 */
const loadData = async (offset, autoRetry = true) => {
    cloud.loading = true
    cloud.selectedRowKeys = []
    let resp = await cloudGet({ limit: 100, offset })
    if (!validCode.includes(resp.code)) {
        if (autoRetry) {
            await checkLogin(user)
            loadData(offset, false)
        } else {
            message.warn('获取网盘数据失败，请稍后重试或者要不试试重新登录～')
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
/**
 * 将元数据简化，便于其它地方使用
 * @param {接口返回来的歌曲元数据} item 
 */
const convert = item => {
    let { songId, asid, songName, simpleSong, artist, album, fileSize, addTime } = item
    songName ||= simpleSong.name || ''
    artist ||= simpleSong?.ar?.[0]?.name || ''
    album ||= simpleSong?.al?.name || ''
    let search = [songName, artist, album].join('@@').replace(/\s+/ig, '').toLowerCase()
    let pic = simpleSong?.al?.picUrl || ''
    return { songId, asid, songName, artist, album, search, pic, fileSize, addTime };
}

/**
 * 重新初始化刷新列表
 */
const reload = async () => {
    pagination.current = 1
    cloud.selectedRowKeys = []
    await loadData(0)
}


const download = async item => {
    let resp = await songInfo({ ids: [item.songId], level: 'hires' })
    if (validCode.includes(resp.code)) {
        let song = resp.data[0]
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
    } else {
        message.warn('获取链接地址失败，但重试几次或换个时间段再试没准会有奇效～')
    }
}

const matchdata = reactive({
    item: null,
    show: false
})

const match = async () => {
    matchdata.show = false
    const record = matchdata.item
    if (!record.asid) {
        message.info('您还没有输入任何内容，若想清空已有的匹配请输入0')
        return
    }
    record.asid = record.asid.trim()
    // https://music.163.com/#/song?id=12345
    // https://music.163.com/song?id=12345&userid=12345
    let urlmatch = record.asid.match(/music\.163\.com\/(?:#\/)?(?<type>\w+).*[?&]id=(?<asid>\d+)/)
    if (!urlmatch) {
        // https://y.music.163.com/m/song/12345
        urlmatch = record.asid.match(/music\.163\.com\/m\/(?<type>\w+)\/(?<asid>\d+)/)
    }
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
    let resp = await songMatch({ userId: user.id, adjustSongId: record.asid, songId: record.songId })
    if (validCode.includes(resp.code)) {
        message.success('歌曲信息已匹配纠正～')
        Object.assign(record, convert(resp.matchData))
        delete record.asid
    } else {
        message.warn(resp.message)
    }
}

const remove = item => {
    Modal.confirm({
        title: '删除网盘音乐',
        content: `确定要删除「${item.songName}」吗？（删除后不可恢复）`,
        okText: '确认',
        cancelText: '取消',
        async onOk() {
            let resp = await cloudDel({ songIds: [item.songId] })
            if (validCode.includes(resp.code)) {
                cloud.allData = cloud.allData.filter(record => item.songId != record.songId)
                message.success('删除云盘指定音乐成功')
            } else {
                message.warn('删除云盘音乐失败，但重试几次或换个时间段再试没准会有奇效～')
            }
        }
    });
}

onMounted(reload)

defineExpose({ reload })
</script>
<template>
    <div>
        <a-form layout="inline">
            <a-form-item :wrapper-col="{ offset: 2 }">
                <a-input v-model:value="cloud.filter"
                         placeholder="输入内容快速检索"
                         enterkeyhint="done"
                         class="filter-input" />
            </a-form-item>
        </a-form>

        <a-list :data-source="cloud.data"
                :pagination="pagination"
                size="small"
                item-layout="vertical"
                :loading="cloud.loading">
            <template #renderItem="{ item }">
                <a-list-item>
                    <template #actions>
                        <a key="list-loadmore-edit"
                           @click="matchdata.item = item; matchdata.show = true"># 匹配</a>

                        <a key="list-loadmore-del"
                           @click="remove(item)">&times; 删除</a>

                        <a key="list-loadmore-download"
                           @click="download(item)"
                           v-if="item.dlPercent == null">↓ 下载</a>
                        <span v-else-if="item.dlPercent < 100">
                            {{ item.dlPercent }}%
                        </span>
                        <span v-else>✓ 完成</span>
                    </template>
                    <a-list-item-meta>
                        <template #title>
                            <a-typography-text ellipsis
                                               :content="item.songName" />
                        </template>
                        <template #description>
                            <a-typography-text ellipsis
                                               :content="`${item.artist} - ${item.album}`" />
                        </template>
                        <template #avatar>
                            <a-avatar :src="item.pic"
                                      :size="58"
                                      shape="square" />
                        </template>
                    </a-list-item-meta>
                </a-list-item>
            </template>
        </a-list>
        <a-modal :visible="matchdata.show"
                 title="歌曲信息匹配修正"
                 @ok="match"
                 @cancel="matchdata.show = false">
            <a-typography-paragraph ellipsis
                                    :content="`当前歌曲：${matchdata.item.songName}`" />
            <a-form>
                <a-form-item>
                    <a-input v-model:value="matchdata.item.asid"
                             placeholder="匹配ID或链接"
                             autofocus />
                </a-form-item>
            </a-form>
            <a-typography-paragraph>
                <blockquote>利用网易云音乐中已有的歌曲信息替换网盘中的歌曲信息，以便能获取歌词、图片等信息，网盘音乐播放和下载时的音乐文件还是原来上传的文件，若想取消替换，输入0即可</blockquote>
            </a-typography-paragraph>
        </a-modal>
    </div>
</template>
<style>
.match-edit .ant-input-group-compact {
    display: flex;
}
</style>