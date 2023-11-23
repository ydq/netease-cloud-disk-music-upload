import { ArrayBuffer as MD5 } from 'spark-md5'


const file2ArrayBuffer = file => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = e => resolve(e.target.result)
        reader.onerror = reject
        reader.readAsArrayBuffer(file)
    })
}

const calcFileMd5 = async (file, isRetry) => {
    let data = await file2ArrayBuffer(file)
    if (isRetry) {
        data = data.transfer(data.maxByteLength + 1)
    }
    return MD5.hash(data)
}

const filterList = (data, filter) => {
    if (filter) {
        //全局忽略大小写分字搜索，支持  输入  “hloy”  命中匹配  “Hello How Are You”
        data = data.filter(record => {
            //标题、歌手、专辑 分开匹配，不能标题命中第一个搜索字，歌手命中第二个搜索字
            let searchs = record.search.split('@@')
            let arrs = filter.split('')
            out: for (let s of searchs) {
                let idx = -1;
                for (let c of arrs) {
                    if ((idx = s.indexOf(c, idx + 1)) == -1) {
                        continue out;
                    }
                }
                return true
            }
            return false
        })
    }
    return data;
}

export { file2ArrayBuffer, calcFileMd5, filterList }