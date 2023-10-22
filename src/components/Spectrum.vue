<script setup>
import { inject, onMounted, ref, watch } from 'vue';
import { spectrum, spectrumInit, spectrumRenderFrame } from '@/js/spectrum.js'

//顶部播放音乐的频谱组件
const props = defineProps(['audio'])
const canvasEl = ref()

const isDark = inject('isDark')

//监听 播放器的播放状态 防止频谱绘制 一直空轮询消耗性能
props.audio.addEventListener("playing", e => {
    if (!spectrum.isPlaying) {
        spectrum.isPlaying = true
        setTimeout(spectrumRenderFrame, 300)
    }
});
props.audio.addEventListener("pause", e => {
    spectrum.isPlaying = false
});


const changeSpectrumColor = () => {
    Object.assign(spectrum, isDark.value ? {
        capColor: '#444',
        fromColor: '#666',
        toColor: '#333'
    } : {
        capColor: '#CEE2F3',
        fromColor: '#E0EEDA',
        toColor: '#CEE2F3'
    })
    if (spectrum.ctx) {
        let gradient = spectrum.ctx.createLinearGradient(0, 0, 0, spectrum.canvasHeight)
        gradient.addColorStop(0, spectrum.fromColor)
        gradient.addColorStop(1, spectrum.toColor)
        spectrum.gradient = gradient
    }
}


watch(isDark, e => changeSpectrumColor())

onMounted(() => {
    changeSpectrumColor();
    spectrumInit(props.audio, canvasEl.value)
})
</script>
<template>
    <canvas id="spectrumCanvas"
            ref="canvasEl"></canvas>
</template>
<style>
#spectrumCanvas {
    position: absolute;
    width: 960px;
    height: 100px;
    top: 0;
    right: 0;
    transform: rotateY(180deg);
    z-index: -1;
    pointer-events: none;
}
</style>