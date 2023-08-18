import { reactive } from "vue"

/**
 * 频谱配置
 */
const spectrum = reactive({
    isPlaying: false,
    canvasWidth: null,
    canvasHeight: null,
    ctx: null,
    analyser: null,
    gradient: null,
    meterNum: null,
    meterWidth: 6,
    gap: 2,
    capHeight: 4,
    capColor: '#CEE2F3',
    capYPosition: [],
    fromColor: '#E0EEDA',
    toColor: '#CEE2F3'
})
/**
 * 初始化频谱
 */
const spectrumInit = (audio, canvas) => {
    canvas.height = spectrum.canvasHeight = canvas.clientHeight * 2
    canvas.width = spectrum.canvasWidth = canvas.clientWidth * 2
    spectrum.ctx = canvas.getContext("2d")
    if (spectrum.analyser != null) {
        //已经初始化过了，无需再次初始化
        return;
    }
    spectrum.meterNum = Math.round(spectrum.canvasWidth / (spectrum.meterWidth + spectrum.gap))
    let audioCtx = new AudioContext()
    spectrum.analyser = audioCtx.createAnalyser()
    audioCtx.createMediaElementSource(audio).connect(spectrum.analyser)
    spectrum.analyser.connect(audioCtx.destination)
    spectrum.gradient = spectrum.ctx.createLinearGradient(0, 0, 0, spectrum.canvasHeight)
    spectrum.gradient.addColorStop(0, spectrum.fromColor)
    spectrum.gradient.addColorStop(1, spectrum.toColor)
    spectrum.isPlaying && spectrumRenderFrame();
}
/**
 * 循环绘制频谱
 */
const spectrumRenderFrame = () => {
    spectrum.ctx.clearRect(0, 0, spectrum.canvasWidth, spectrum.canvasHeight + spectrum.capHeight)
    let array = new Uint8Array(spectrum.analyser.frequencyBinCount)
    spectrum.analyser.getByteFrequencyData(array)
    let step = Math.floor(array.length / spectrum.meterNum)
    spectrum.ctx.clearRect(0, 0, spectrum.canvasWidth, spectrum.canvasHeight)
    for (let i = 0; i < spectrum.meterNum; i++) {
        let value = (array[i * step] * spectrum.canvasHeight) / spectrum.canvasHeight
        if (spectrum.capYPosition.length < spectrum.meterNum)
            spectrum.capYPosition.push(value)
        spectrum.ctx.fillStyle = spectrum.capColor
        let xPos = i * (spectrum.meterWidth + spectrum.gap)
        if (value < spectrum.capYPosition[i]) {
            spectrum.ctx.fillRect(
                xPos,
                spectrum.canvasHeight - --spectrum.capYPosition[i],
                spectrum.meterWidth,
                spectrum.capHeight
            );
        } else {
            spectrum.ctx.fillRect(
                xPos,
                Math.max(0, spectrum.canvasHeight - value),
                spectrum.meterWidth,
                spectrum.capHeight
            );
            spectrum.capYPosition[i] = value
        }
        spectrum.ctx.fillStyle = spectrum.gradient
        spectrum.ctx.fillRect(
            xPos,
            Math.max(0, spectrum.canvasHeight - value) + spectrum.capHeight,
            spectrum.meterWidth,
            spectrum.canvasHeight
        );
    }
    if (spectrum.isPlaying) {
        requestAnimationFrame(spectrumRenderFrame)
    } else {
        spectrum.ctx.clearRect(0, 0, spectrum.canvasWidth, spectrum.canvasHeight)
    }
}

export { spectrum, spectrumInit, spectrumRenderFrame }