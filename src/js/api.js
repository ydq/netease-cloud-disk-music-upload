import axios from 'axios'
import { file2ArrayBuffer } from '/src/js/helper'

const instance = axios.create({
    timeout: 60000,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    withCredentials: 'true',
    responseType: 'json'
})

/**
 * 获取账号信息
 */
const userAccount = async (data = {}) => {
    return (await instance.post('https://music.163.com/api/nuser/account/get', new URLSearchParams(data).toString())).data
}

/**
 * 获取网盘音乐列表
 */
const cloudGet = async (data = { limit: 20, offset: 0 }) => {
    return (await instance.post('https://music.163.com/api/v1/cloud/get', new URLSearchParams(data).toString())).data
}

/**
 * 上传step1: 检查
 */
const uploadCheck = async (data = {
    length: 0,
    md5: ''
}) => {
    data = Object.assign({}, {
        bitrate: '999000',
        ext: '',
        songId: '0',
        version: 1,
    }, data)
    return (await instance.post('https://interface.music.163.com/api/cloud/upload/check', new URLSearchParams(data).toString())).data
}

/**
 * 上传step2: 获取token
 */
const uploadToken = async (data = {
    ext: '',
    filename: '',
    md5: '',
}) => {
    data = Object.assign({
        bucket: '',
        local: false,
        nos_product: 3,
        type: 'audio',
    }, data)
    return (await instance.post('https://music.163.com/api/nos/token/alloc', new URLSearchParams(data).toString())).data
}

/**
 * 上传step3: 上传文件（根据 step1 检查结果判断是否需要上传）
 * 过大的文件需要分片上传（这里经过尝试发现100M以内直接上传是安全的，过大的文件分隔成80M的分片进行上传）
 */
const singleFileMaxSize = 100 * 1024 * 1024
const chunkSize = 80 * 1024 * 1024
const splitFile = async (file, start, end) => {
    let blobSlice = File.prototype.slice || File.prototype.webkitSlice
    return new Promise((resolve, reject) => {
        let fileReader = new FileReader()
        fileReader.onload = e => resolve(e.target.result)
        fileReader.onerror = reject
        fileReader.readAsArrayBuffer(blobSlice.call(file, start, end))
    })
}
const uploadFile = async (data = {
    file: null,
    md5: '',
    objectKey: '',
    token: '',
}, isRetry, onUploadProgress = e => { }) => {
    let objectKey = data.objectKey.replace('/', '%2F')
    let headers = {
        'x-nos-token': data.token,
        'Content-MD5': data.md5,
        'Content-Type': data.file.type
    }
    let totalSize = data.file.size
    if (totalSize < singleFileMaxSize) {
        //小于100M直接上传
        if (isRetry) {
            const fileBuffer = await file2ArrayBuffer(data.file)
            await upload(headers, fileBuffer.transfer(fileBuffer.maxByteLength + 1), objectKey, 0, true, null, onUploadProgress)
        } else {
            await upload(headers, data.file, objectKey, 0, true, null, onUploadProgress)
        }
    } else {
        //大于100M的文件进行分片
        let chunks = Math.ceil(totalSize / chunkSize)
        let context = ''
        for (let i = 0; i < chunks; i++) {
            let isLast = i == chunks - 1
            //计算文件分片的起止offset
            let start = i * chunkSize
            let end = isLast ? totalSize : (start + chunkSize)
            //文件分片
            let partData = await splitFile(data.file, i * chunkSize, end)
            if (isRetry && isLast) {
                partData = partData.transfer(partData.maxByteLength + 1)
            }
            //文件分片，进度条事件需要重写
            let proxyProgress = e => {
                let loaded = start + e.loaded
                onUploadProgress({ loaded, progress: loaded / totalSize, total: totalSize, upload: true })
            }
            //上传分片
            let resp = (await upload(headers, partData, objectKey, start, isLast, context, proxyProgress)).data
            //分片数据需要获取上下文 content
            context = resp.context || context
        }

    }
}
//底层的文件上传服务
const upload = async (headers, data, objectKey, offset, complete, context, onUploadProgress) => {
    let url = `http://45.127.129.8/jd-musicrep-privatecloud-audio-public/${objectKey}?offset=${offset}&complete=${complete}&version=1.0`
    if (context) {
        url += `&context=${context}`
    }
    return await axios({
        method: 'post',
        url,
        headers,
        data,
        onUploadProgress
    })
}

/**
 * 上传step4: 修正文件信息（让客户端看起来的名字美观一些）
 */
const cloudInfo = async (data = {
    md5: '文件MD5',
    songid: 'check接口 songId',
    filename: '文件名称，包含后缀',
    song: '歌曲名称',
    album: '未知专辑',
    artist: '未知艺术家',
    resourceId: 'token接口 result.resourceId ',
}) => {
    data = Object.assign({
        bitrate: '999000',
    }, data)
    return (await instance.post('https://music.163.com/api/upload/cloud/info/v2', new URLSearchParams(data).toString())).data
}

/**
 * 上传step5: 保存到云盘
 */
const cloudPub = async (data = {
    songid: 'check接口 songId'
}) => {
    return (await instance.post('https://interface.music.163.com/api/cloud/pub/v2', new URLSearchParams(data).toString())).data
}

/**
 * 删除云盘歌曲
 */
const cloudDel = async (data = { songIds: [] }) => {
    data.songIds = JSON.stringify(data.songIds)
    return (await instance.post('https://music.163.com/api/cloud/del', new URLSearchParams(data).toString())).data
}

/**
 * 获取音乐详情（格式/地址等）
 */
const songInfo = async (data = {
    ids: [],
}) => {
    data = Object.assign({
        level: 'standard',//standard, exhigh, lossless, hires
        encodeType: 'flac'
    }, data)
    data.ids = JSON.stringify(data.ids)
    return (await instance.post('https://interface.music.163.com/api/song/enhance/player/url/v1', new URLSearchParams(data).toString())).data
}


const lyric = async (data = {
    id: null
}) => {
    data = Object.assign({
        tv: -1,
        lv: -1,
        rv: -1,
        kv: -1,
    }, data)
    return (await instance.post('https://music.163.com/api/song/lyric?_nmclfl=1', new URLSearchParams(data).toString())).data
}

const songMatch = async (data = {
    userId: null,
    songId: null,
    adjustSongId: null
}) => {
    return (await instance.post('https://music.163.com/api/cloud/user/song/match', new URLSearchParams(data).toString())).data
}


const loginKey = async (data = { type: 1 }) => {
    return (await instance.post('https://music.163.com/api/login/qrcode/unikey', new URLSearchParams(data).toString())).data
}

const checkScan = async (data = { key: null }) => {
    data = Object.assign({ type: 1 }, data)
    return (await instance.post('https://music.163.com/api/login/qrcode/client/login', new URLSearchParams(data).toString())).data
}

/**
 * 一些可能合法的返回code（如：已经上传过的音乐再次上传，返回 201，其它 code 来自于 NeteaseCloudMusicApi ）
 */
const validCode = [200, 201, 800, 801, 802, 803]


export { userAccount, cloudGet, uploadCheck, uploadToken, uploadFile, cloudInfo, cloudPub, cloudDel, songInfo, lyric, songMatch, loginKey, checkScan, validCode }