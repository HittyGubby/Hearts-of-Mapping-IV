<template>
    <div class="map-container" ref="containerRef" @mousemove="updateCursor">
        <svg ref="svgRef" class="map-svg" id="map-svg" @wheel.prevent="handleWheel" @mousedown="handleMouseDown"
            @mousemove="updateCursor" @mouseup="handleMouseUp" @mouseenter="isCursorInScreen = true"
            @mouseleave="isCursorInScreen = false" @click="handleClick" @contextmenu.prevent="handleClick">
            <g :transform="transformMatrix">
                <g v-for="(tile, idx) in visibleTiles" :key="idx" :transform="tile.transform">
                    <g ref="mapContentRef" v-html="mapSVG" />
                </g>
                <rect v-if="dragRect" :x="dragRect.x" :y="dragRect.y" :width="dragRect.w" :height="dragRect.h" :style="{
                    fill: 'rgba(0, 0, 0, 0)',
                    stroke: '#ffffff',
                    strokeWidth: 0.8 * camera.z / zMax,
                    pointerEvents: 'none'
                }" class="selection-rect" />
            </g>
        </svg>
        <div class="debug-overlay" v-if="store.showDebugInfo">
            <div>CamPos: ({{ camera.x.toFixed(2) }}, {{ camera.y.toFixed(2) }}, {{ camera.z.toFixed(2) }})</div>
            <div>Velocity: ({{ velocity.x.toFixed(2) }}, {{ velocity.y.toFixed(2) }}, {{ velocity.z.toFixed(2) }})</div>
            <div>CursorPos(Map): ({{ cursorMap.x.toFixed(2) }}, {{ cursorMap.y.toFixed(2) }})</div>
            <div>CursorPos(Screen): ({{ cursorScreenPos.x }}, {{ cursorScreenPos.y }})</div>
            <div>YCoordRange: [{{ yRange.min.toFixed(2) }}, {{ yRange.max.toFixed(2) }}]</div>
            <div>Zoom: {{ camera.z.toFixed(2) }}/{{ zMax.toFixed(2) }}</div>
            <div>Mode: {{ store.mode }}</div>
            <div>Selected Country: {{ store.selectedCountryId || 'None' }}</div>
            <div>Highlighted Provinces: {{ Array.from(store.highlightedProvinces).join(', ') || 'None' }}</div>
            <div>Clicked Province: {{ store.clickedProvinceId || 'None' }}</div>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, reactive, computed, nextTick } from 'vue';
import { store } from '../store.js';

const panSensitivityKeyboard = 0.005;
const panSensitivityMouse = 0.005;
const zoomSensitivityKeyboard = 0.005;
const zoomSensitivityMouse = 0.02;
const edgePanWidthRatio = 0.05;
const zMin = 2.0;
const lerpAcceleration = 0.9;
const mapHeight = 509.39001;
const mapWidth = 1400.16;

const camera = reactive({ x: 0, y: 0, z: 50 });
const velocity = reactive({ x: 0, y: 0, z: 0 });
const cursorScreenPos = reactive({ x: 0, y: 0 });

const svgRef = ref(null);
const mapContentRef = ref(null);
const mapSVG = ref('');
const containerRef = ref(null);
const cursorMap = reactive({ x: 0, y: 0 });

const dragStart = ref(null);
const dragEnd = ref(null);
const dragRect = computed(() => {
    if (!dragStart.value || !dragEnd.value) return null;
    const x1 = Math.min(dragStart.value.x, dragEnd.value.x);
    const y1 = Math.min(dragStart.value.y, dragEnd.value.y);
    const x2 = Math.max(dragStart.value.x, dragEnd.value.x);
    const y2 = Math.max(dragStart.value.y, dragEnd.value.y);
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
});


let animationFrame = null;
let isCursorInScreen = true;
let arrowKeys = { left: false, right: false, up: false, down: false, pageUp: false, pageDown: false };

const fov = 90;
const fovRad = computed(() => (fov * Math.PI) / 180);
const zMax = computed(() => mapHeight / 2.0 / Math.tan(fovRad.value / 2.0));

const yRange = computed(() => {
    const ymin = camera.z * Math.tan(fovRad.value / 2.0);
    const ymax = mapHeight - camera.z * Math.tan(fovRad.value / 2.0);
    return { min: ymin, max: ymax };
});

//3d coords to 2d matrix
const transformMatrix = computed(() => {
    const container = containerRef.value;
    if (!container) return '';
    const screenW = container.clientWidth;
    const screenH = container.clientHeight;
    const scale = screenH / mapHeight * (zMax.value / camera.z);
    const tx = screenW / 2 - camera.x * scale;
    const ty = screenH / 2 - camera.y * scale;
    return `translate(${tx},${ty}) scale(${scale},${scale})`;
});

const visibleTiles = computed(() => {
    const tiles = [];
    tiles.push({ transform: `translate(${(Math.floor(camera.x / mapWidth) - 0.5) * mapWidth}, 0)` });
    tiles.push({ transform: `translate(${(Math.floor(camera.x / mapWidth) + 0.5) * mapWidth}, 0)` });
    return tiles;
});

function getProvinceElements() {
    if (!svgRef.value) return [];
    return svgRef.value.querySelectorAll('#provinces path');
}

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
    const ndcY = (mouseY / view.y - 0.5) * 2;
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
    if (dragStart.value) {
        dragEnd.value = { ...cursorMap };
    }
}


function handleMouseDown(event) {
    dragStart.value = { ...cursorMap };
    dragEnd.value = null;
}

function handleMouseUp(event) {
    const rect = dragRect.value;
    dragStart.value = null;
    dragEnd.value = null;

    const selectedProvIds = Array.from(getProvinceElements())
        .filter(p => {
            const bbox = p.getBBox();
            const cx = bbox.x + bbox.width / 2;
            const cy = bbox.y + bbox.height / 2;
            return (
                cx >= rect.x &&
                cx <= rect.x + rect.w &&
                cy >= rect.y &&
                cy <= rect.y + rect.h
            );
        })
        .map(p => p.id);

    const isRightClick = event.button === 2;
    const paintMode = store.mode === 'paint' || store.mode === 'erase';
    const effectiveLeft = (store.mode === 'erase' ? isRightClick : !isRightClick);
    if (paintMode) {
        for (const id of selectedProvIds) {
            const target = effectiveLeft ? store.selectedCountryId : null;
            store.assignProvince(id, target);
        }
    }
}


function handleClick(event) {
    const target = event.target;
    if (target.tagName === 'path') {
        store.clickedProvinceId = target.id;
        handleProvinceClick(target.id, event.button);
    } else {
        store.clearHighlight();
    }
}

function handleProvinceClick(provId, button) {
    const isLeftClick = button === 0;
    const isRightClick = button === 2;
    if (store.mode === 'paint') {
        if (isLeftClick && store.selectedCountryId) {
            store.assignProvince(provId, store.selectedCountryId);
        } else if (isRightClick) {
            store.assignProvince(provId, null);
        }
    } else if (store.mode === 'erase') {
        if (isLeftClick) {
            store.assignProvince(provId, null);
        } else if (isRightClick && store.selectedCountryId) {
            store.assignProvince(provId, store.selectedCountryId);
        }
    } else if (store.mode === 'select') {
        if (isLeftClick) {
            store.selectedCountryId = store.getProvinceOwner(provId);
        } else if (isRightClick) {
            store.setHighlightByCountry(store.getProvinceOwner(provId));
        }
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
    const ndcY = (mouseY / view.y - 0.5) * 2;
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

function startAnimationLoop() {
    function animate() {
        const container = containerRef.value;
        if (!container) {
            animationFrame = requestAnimationFrame(animate);
            return;
        }
        const view = { x: container.clientWidth, y: container.clientHeight };
        const edgethres = { x: view.x * edgePanWidthRatio, y: view.y * edgePanWidthRatio };
        const fac = camera.z * panSensitivityKeyboard;
        const facmouse = camera.z * panSensitivityMouse;
        const mx = cursorScreenPos.x;
        const my = cursorScreenPos.y;
        if (mx >= 0 && mx <= view.x && my >= 0 && my <= view.y && isCursorInScreen) {
            if (mx < edgethres.x) velocity.x += -facmouse * (1 - mx / edgethres.x);
            else if (mx > view.x - edgethres.x) velocity.x += facmouse * (1 - (view.x - mx) / edgethres.x);
            if (my < edgethres.y) velocity.y += -facmouse * (1 - my / edgethres.y);
            else if (my > view.y - edgethres.y) velocity.y += facmouse * (1 - (view.y - my) / edgethres.y);
        }
        if (arrowKeys.left) velocity.x -= fac;
        if (arrowKeys.right) velocity.x += fac;
        if (arrowKeys.up) velocity.y -= fac;
        if (arrowKeys.down) velocity.y += fac;
        if (arrowKeys.pageUp) velocity.z -= camera.z * zoomSensitivityKeyboard;
        if (arrowKeys.pageDown) velocity.z += camera.z * zoomSensitivityKeyboard;

        const newpos = {
            x: camera.x + velocity.x,
            y: camera.y + velocity.y,
            z: camera.z + velocity.z
        };
        //wrap x coord for seamless scrolling
        if (newpos.x > mapWidth / 2.0) newpos.x -= mapWidth;
        else if (newpos.x < -mapWidth / 2.0) newpos.x += mapWidth;
        //clamp y and z
        newpos.y = Math.max(yRange.value.min, Math.min(newpos.y, yRange.value.max));
        newpos.z = Math.max(zMin, Math.min(newpos.z, zMax.value));

        camera.x = newpos.x;
        camera.y = newpos.y;
        camera.z = newpos.z;
        //vel decay exponentially
        if (Math.abs(velocity.x) > 0.01) velocity.x *= lerpAcceleration; else velocity.x = 0;
        if (Math.abs(velocity.y) > 0.01) velocity.y *= lerpAcceleration; else velocity.y = 0;
        if (Math.abs(velocity.z) > 0.01) velocity.z *= lerpAcceleration; else velocity.z = 0;

        animationFrame = requestAnimationFrame(animate);
    }
    animate();
}

function updateProvinceFills() {
    getProvinceElements().forEach(path => {
        const provId = path.id;
        let ownerColor = '#cccccc';
        for (const countryId in store.countries) {
            if (store.countries[countryId].provinces.includes(provId)) {
                ownerColor = store.countries[countryId].color;
                break;
            }
        }
        path.setAttribute('fill', ownerColor);
    });
}

function updateHighlights() {
    getProvinceElements().forEach(path => {
        if (store.highlightedProvinces.has(path.id)) {
            path.style.animation = 'blink-gold 1s infinite';
        } else {
            path.style.animation = 'none';
        }
    });
}

//lifecycle
onMounted(async () => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const response = await fetch(`/maps/${store.mapType}.svg`);
    const svgText = await response.text();
    mapSVG.value = svgText;
    await nextTick();
    //init cam pos
    camera.x = 0;
    camera.y = mapHeight / 2;
    camera.z = 500;

    updateProvinceFills();
    startAnimationLoop();
});

onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
    if (animationFrame) cancelAnimationFrame(animationFrame);
});

//watchers(??)
watch(() => store.countries, updateProvinceFills, { deep: true });
watch(() => store.highlightedProvinces, updateHighlights, { deep: true });
</script>

<style scoped>
.map-container {
    width: 100%;
    height: 100%;
    position: absolute;
    background: #ffffff;
    background: radial-gradient(circle, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 1) 6%, rgb(0, 43, 78) 10%, rgb(0, 3, 41) 100%);
}

.map-svg {
    width: 100%;
    height: 100%;
}

.debug-overlay {
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