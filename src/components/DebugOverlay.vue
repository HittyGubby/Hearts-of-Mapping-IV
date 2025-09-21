<template>
    <div class="debug-text" v-if="store.showDebugInfo">
        <div>CamPos: ({{ camera.x.toFixed(2) }}, {{ camera.y.toFixed(2) }}, {{ camera.z.toFixed(2) }})</div>
        <div>Velocity: ({{ velocity.x.toFixed(2) }}, {{ velocity.y.toFixed(2) }}, {{ velocity.z.toFixed(2) }})</div>
        <div>CursorPos(Map): ({{ cursorMap.x.toFixed(2) }}, {{ cursorMap.y.toFixed(2) }})</div>
        <div>CursorPos(Screen): ({{ cursorScreenPos.x }}, {{ cursorScreenPos.y }})</div>
        <div>YCoordRange: [{{ yRange.min.toFixed(2) }}, {{ yRange.max.toFixed(2) }}]</div>
        <div>Zoom: {{ camera.z.toFixed(2) }}/{{ zMax.toFixed(2) }}</div>
        <div>Mode: {{ store.mode }}</div>
        <div>Selected Country: {{ store.selectedCountryId || 'None' }}</div>
        <div>Clicked Province ID: {{ store.clickedProvinceId || 'None' }}</div>
        <div>Clicked Province Type: {{ store.clickedProvinceType || 'None' }}</div>
        <div>Clicked Province Color: #{{ store.clickedProvinceColor || 'None' }}</div>
    </div>
    <div class="texture-display" v-if="store.showDebugInfo">
        <div class="palette">
            <div>Original Lookup:</div>
            <canvas ref="originalPaletteCanvasRef"></canvas>
        </div>
        <div class="palette">
            <div>Current Lookup:</div>
            <canvas ref="currentPaletteCanvasRef"></canvas>
        </div>
    </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue';
import { store } from '../store.js';

// Props to receive data from parent component
const props = defineProps({
    camera: {
        type: Object,
        required: true
    },
    velocity: {
        type: Object,
        required: true
    },
    cursorMap: {
        type: Object,
        required: true
    },
    cursorScreenPos: {
        type: Object,
        required: true
    },
    yRange: {
        type: Object,
        required: true
    },
    zMax: {
        type: Number,
        required: true
    },
    originalPalette: {
        type: Object,
        default: null
    },
    currentPalette: {
        type: Object,
        default: null
    }
});

const originalPaletteCanvasRef = ref(null);
const currentPaletteCanvasRef = ref(null);

function drawPalette(canvas, palette) {
    if (!canvas || !palette) return;
    canvas.width = palette.width;
    canvas.height = palette.height;
    const ctx = canvas.getContext('2d');
    const imageData = new ImageData(new Uint8ClampedArray(palette.data), palette.width, palette.height);
    ctx.putImageData(imageData, 0, 0);
}

watch(() => [props.originalPalette, props.currentPalette, store.showDebugInfo], () => {
    if (store.showDebugInfo) {
        nextTick(() => {
            drawPalette(originalPaletteCanvasRef.value, props.originalPalette);
            drawPalette(currentPaletteCanvasRef.value, props.currentPalette);
        });
    }
}, { immediate: true, deep: true });
</script>

<style scoped>
.debug-text {
    position: absolute;
    top: 50%;
    left: 8px;
    transform: translateY(-50%);
    background: rgba(0, 0, 0, 0.7);
    color: #fff;
    font-size: 13px;
    padding: 8px 12px;
    border-radius: 8px;
    z-index: 20;
    pointer-events: none;
    user-select: text;
    font-family: monospace;
    min-width: 220px;
}

.texture-display {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    right: 8px;
    background: rgba(0, 0, 0, 0.7);
    color: #fff;
    font-size: 13px;
    padding: 8px 12px;
    border-radius: 8px;
    z-index: 20;
    pointer-events: none;
    user-select: text;
    font-family: monospace;
    min-width: 220px;
}

.texture-display .palette {
    margin-bottom: 10px;
}

.texture-display canvas {
    background-color: #000;
    margin-top: 5px;
    image-rendering: pixelated;
    width: 100%;
    height: auto;
}
</style>