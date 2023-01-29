<script setup>
import { spectrumInit } from '@/scripts/spectrum.js'
import { onMounted, ref } from 'vue';

const props = defineProps(['audio'])
const canvasEl = ref()

onMounted(() => spectrumInit(props.audio, canvasEl.value))
</script>
<template>
    <canvas id="spectrumCanvas"
            ref="canvasEl"></canvas>
</template>
<style>
#spectrumCanvas {
    position: absolute;
    width: 960px;
    height: 95px;
    top: 0;
    right: 0;
    transform: rotateY(180deg);
    z-index: -1;
    pointer-events: none;
}
</style>