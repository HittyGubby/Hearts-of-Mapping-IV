<template>
    <DebugOverlay v-if="store.showDebugInfo" :camera="camera" :velocity="velocity" :cursor-map="cursorMap"
        :cursor-screen-pos="cursorScreenPos" :y-range="yRange" :z-max="zMax" :original-palette="originalPalette"
        :current-palette="currentPalette" ref="debugOverlayRef" />
    <div class="map-container" ref="containerRef" @mousemove="updateCursor" @wheel.prevent="handleWheel"
        @mousedown="handleMouseDown" @mouseup="handleMouseUp" @mouseenter="isCursorInScreen = true"
        @mouseleave="isCursorInScreen = false" @click="handleClick" @contextmenu.prevent="handleClick">
        <canvas ref="canvasRef" class="map-canvas"></canvas>

    </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, reactive, computed } from 'vue';
import { store } from '../store.js';
import { initRenderer } from '../webgl/renderer.js';
import DebugOverlay from './DebugOverlay.vue';

// --- Constants ---
const MAP_WIDTH = 5632;
const MAP_HEIGHT = 2048;

// --- Core State ---
let renderer = null;
let animationFrame = null;
let isCursorInScreen = true;
let arrowKeys = { left: false, right: false, up: false, down: false, pageUp: false, pageDown: false };

// --- Refs ---
const containerRef = ref(null);
const canvasRef = ref(null);
const debugOverlayRef = ref(null);
const originalPalette = ref(null);
const currentPalette = ref(null);
const provinceDefinitions = ref([]);

// --- Camera & Controls ---
const panSensitivityKeyboard = 0.005;
const panSensitivityMouse = 0.005;
const zoomSensitivityKeyboard = 0.005;
const zoomSensitivityMouse = 0.02;
const edgePanWidthRatio = 0.05;
const zMin = 2.0;
const lerpAcceleration = 0.9;

const camera = reactive({ x: 0, y: 0, z: 50 });
const velocity = reactive({ x: 0, y: 0, z: 0 });
const cursorScreenPos = reactive({ x: 0, y: 0 });
const cursorMap = reactive({ x: 0, y: 0 });


// --- Computed Properties for Camera ---
const fov = 90;
const fovRad = computed(() => (fov * Math.PI) / 180);
const zMax = computed(() => MAP_HEIGHT / 2.0 / Math.tan(fovRad.value / 2.0));

const yRange = computed(() => {
    const ymin = camera.z * Math.tan(fovRad.value / 2.0);
    const ymax = MAP_HEIGHT - camera.z * Math.tan(fovRad.value / 2.0);
    return { min: ymin, max: ymax };
});

// --- Event Handlers ---

function updateCursor(event) {
    const container = containerRef.value;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    cursorScreenPos.x = mouseX;
    cursorScreenPos.y = mouseY;
    const view = { x: container.clientWidth, y: container.clientHeight };
    const ndcX = (mouseX / view.x - 0.5) * 2;//ray
    const ndcY = -(mouseY / view.y - 0.5) * 2;//ray
    const rayOrigin = { x: camera.x, y: camera.y, z: camera.z };
    const tanHalfFov = Math.tan(fovRad.value / 2.0);
    const aspectRatio = view.x / view.y;
    const rayDir = {
        x: ndcX * camera.z * tanHalfFov * aspectRatio,
        y: ndcY * camera.z * tanHalfFov,
        z: -camera.z
    };
    //project ray to z=0
    const t = -rayOrigin.z / rayDir.z;
    cursorMap.x = rayOrigin.x + rayDir.x * t;
    cursorMap.y = rayOrigin.y + rayDir.y * t;
}

function handleMouseDown(event) { /* Drag-to-select disabled */ }
function handleMouseUp(event) { /* Drag-to-select disabled */ }

function handleClick(event) {
    const province = renderer.getProvinceAt(cursorMap.x, cursorMap.y);
    const provId = province.id;
    const provType = province.type; // 'land', 'sea', 'lake', or undefined
    const provColor = province.color;
    if (provId > 0) {
        store.clickedProvinceId = provId;
        store.clickedProvinceColor = provColor;
        store.clickedProvinceType = provType;
        handleProvinceClick(provId, provType, event.button);
    } else {
        store.clickedProvinceId = null;
        store.clickedProvinceColor = null;
        store.clickedProvinceType = null;
    }
}

function handleProvinceClick(provId, provType, button) {
    const isLeftClick = button === 0;
    const isRightClick = button === 2;
    if (provType == 'sea') return; // Ignore sea provinces
    if (store.mode === 'paint') {
        if (isLeftClick && store.selectedCountryId) store.assignProvince(provId, store.selectedCountryId);
        else if (isRightClick) store.assignProvince(provId, null);
    } else if (store.mode === 'erase') {
        if (isLeftClick) store.assignProvince(provId, null);
        else if (isRightClick && store.selectedCountryId) store.assignProvince(provId, store.selectedCountryId);
    } else if (store.mode === 'select') {
        if (isLeftClick) store.selectedCountryId = store.getProvinceOwner(provId);
    }
}

function handleWheel(event) {
    const container = containerRef.value;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const view = { x: container.clientWidth, y: container.clientHeight };
    const ndcX = (mouseX / view.x - 0.5) * 2;
    const ndcY = -(mouseY / view.y - 0.5) * 2;
    const tanHalfFov = Math.tan(fovRad.value / 2.0);
    const aspectRatio = view.x / view.y;
    const rayOrigin = { x: camera.x, y: camera.y, z: camera.z };
    const rayDir = {
        x: ndcX * camera.z * tanHalfFov * aspectRatio,
        y: ndcY * camera.z * tanHalfFov,
        z: -camera.z
    };
    const t = -rayOrigin.z / rayDir.z;
    const cursorpos = {
        x: rayOrigin.x + rayDir.x * t,
        y: rayOrigin.y + rayDir.y * t,
        z: 0
    };
    const zoomvec = {
        x: cursorpos.x - camera.x,
        y: cursorpos.y - camera.y,
        z: cursorpos.z - camera.z
    };
    const length = Math.sqrt(zoomvec.x * zoomvec.x + zoomvec.y * zoomvec.y + zoomvec.z * zoomvec.z);
    if (length > 0) {
        zoomvec.x /= length;
        zoomvec.y /= length;
        zoomvec.z /= length;
    }
    const zoomfacmouse = camera.z * zoomSensitivityMouse;
    const delta = event.deltaY > 0 ? -1 : 1;
    velocity.x += zoomvec.x * zoomfacmouse * delta;
    velocity.y += zoomvec.y * zoomfacmouse * delta;
    velocity.z += zoomvec.z * zoomfacmouse * delta;
}

function handleKeyDown(e) {
    if (e.key === 'ArrowLeft') arrowKeys.left = true;
    if (e.key === 'ArrowRight') arrowKeys.right = true;
    if (e.key === 'ArrowUp') arrowKeys.up = true;
    if (e.key === 'ArrowDown') arrowKeys.down = true;
    if (e.key === 'PageUp') arrowKeys.pageUp = true;
    if (e.key === 'PageDown') arrowKeys.pageDown = true;
}

function handleKeyUp(e) {
    if (e.key === 'ArrowLeft') arrowKeys.left = false;
    if (e.key === 'ArrowRight') arrowKeys.right = false;
    if (e.key === 'ArrowUp') arrowKeys.up = false;
    if (e.key === 'ArrowDown') arrowKeys.down = false;
    if (e.key === 'PageUp') arrowKeys.pageUp = false;
    if (e.key === 'PageDown') arrowKeys.pageDown = false;
}

// --- Animation Loop ---

function startAnimationLoop() {
    function animate() {
        if (!renderer || !containerRef.value) {
            animationFrame = requestAnimationFrame(animate);
            return;
        }
        const view = { x: containerRef.value.clientWidth, y: containerRef.value.clientHeight };
        const edgethres = { x: view.x * edgePanWidthRatio, y: view.y * edgePanWidthRatio };
        const fac = camera.z * panSensitivityKeyboard;
        const facmouse = camera.z * panSensitivityMouse;
        const mx = cursorScreenPos.x, my = cursorScreenPos.y;
        if (mx >= 0 && mx <= view.x && my >= 0 && my <= view.y && isCursorInScreen) {
            if (mx < edgethres.x) velocity.x += -facmouse * (1 - mx / edgethres.x);
            else if (mx > view.x - edgethres.x) velocity.x += facmouse * (1 - (view.x - mx) / edgethres.x);
            if (my < edgethres.y) velocity.y += facmouse * (1 - my / edgethres.y);
            else if (my > view.y - edgethres.y) velocity.y += -facmouse * (1 - (view.y - my) / edgethres.y);
        }
        if (arrowKeys.left) velocity.x -= fac; if (arrowKeys.right) velocity.x += fac;
        if (arrowKeys.up) velocity.y -= fac; if (arrowKeys.down) velocity.y += fac;
        if (arrowKeys.pageUp) velocity.z -= camera.z * zoomSensitivityKeyboard;
        if (arrowKeys.pageDown) velocity.z += camera.z * zoomSensitivityKeyboard;

        const newpos = { x: camera.x + velocity.x, y: camera.y + velocity.y, z: camera.z + velocity.z };
        if (newpos.x > MAP_WIDTH / 2.0) newpos.x -= MAP_WIDTH;
        else if (newpos.x < -MAP_WIDTH / 2.0) newpos.x += MAP_WIDTH;
        newpos.y = Math.max(yRange.value.min, Math.min(newpos.y, yRange.value.max));
        newpos.z = Math.max(zMin, Math.min(newpos.z, zMax.value));

        camera.x = newpos.x; camera.y = newpos.y; camera.z = newpos.z;

        if (Math.abs(velocity.x) > 0.01) velocity.x *= lerpAcceleration; else velocity.x = 0;
        if (Math.abs(velocity.y) > 0.01) velocity.y *= lerpAcceleration; else velocity.y = 0;
        if (Math.abs(velocity.z) > 0.01) velocity.z *= lerpAcceleration; else velocity.z = 0;

        const canvas = canvasRef.value;
        if (canvas.width !== view.x || canvas.height !== view.y) {
            canvas.width = view.x; canvas.height = view.y;
        }
        renderer.render(camera, canvas.width, canvas.height);
        animationFrame = requestAnimationFrame(animate);
    }
    animate();
}

// --- Data Update & Debug Functions ---

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
}

// --- Lifecycle Hooks ---

onMounted(async () => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    try {
        const provDefs = await fetch(`/vanilla/provinces.json`).then(res => res.json());
        provinceDefinitions.value = provDefs;
        const { renderer: rend, originalPaletteData } = await initRenderer(canvasRef.value, `/vanilla/provinces.png`, MAP_WIDTH, MAP_HEIGHT, provDefs, `/vanilla/states.json`);
        renderer = rend;
        originalPalette.value = originalPaletteData;
        currentPalette.value = renderer.getPaletteData();
        camera.x = 0;
        camera.y = MAP_HEIGHT / 2;
        camera.z = 500;
        startAnimationLoop();
    } catch (error) {
        console.error("Failed to initialize map renderer:", error);
    }
});

onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
    if (animationFrame) cancelAnimationFrame(animationFrame);
});

watch(() => store.showDebugInfo, (isShown) => {
    if (isShown && renderer) {
        currentPalette.value = renderer.getPaletteData();
    }
});

watch(() => store.countries, () => {
    if (!renderer || !provinceDefinitions.value.length) return;

    const provinceToOwner = new Map();
    for (const [countryId, countryData] of Object.entries(store.countries)) {
        for (const provinceId of countryData.provinces) {
            provinceToOwner.set(provinceId, countryId);
        }
    }

    for (const province of provinceDefinitions.value) {
        const ownerId = provinceToOwner.get(province.id);
        if (ownerId) {
            const colorHex = store.countries[ownerId].color;
            const colorRgb = hexToRgb(colorHex);
            if (colorRgb) {
                renderer.setProvinceColor(province.id, colorRgb.r, colorRgb.g, colorRgb.b, 255);
            }
        } else {
            // Fallback for unowned provinces
            if (province.type === 'sea' || province.type === 'lake') {
                renderer.setProvinceColor(province.id, 0, 0, 0, 0); // Transparent
            } else { // land or lake
                renderer.setProvinceColor(province.id, 0x33, 0x33, 0x33, 255); // #333333
            }
        }
    }

    if (store.showDebugInfo) {
        currentPalette.value = renderer.getPaletteData();
    }
}, { deep: true });
</script>

<style scoped>
.map-container {
    width: 100%;
    height: 100%;
    position: absolute;
    background: #ffffff;
    background: radial-gradient(circle, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 1) 6%, rgb(0, 43, 78) 10%, rgb(0, 3, 41) 100%);
}

.map-canvas {
    width: 100%;
    height: 100%;
}

@keyframes blink-gold {

    0%,
    50% {
        fill: #eaff00;
    }

    51%,
    100% {
        fill: #ffed4e;
    }
}
</style>