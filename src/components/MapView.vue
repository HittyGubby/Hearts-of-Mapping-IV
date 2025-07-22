<template>
    <div class="map-container" ref="containerRef" @mousemove="updateCursor">
        <svg ref="svgRef" class="map-svg" @wheel.prevent="handleWheel" @mousedown="handleMouseDown"
            @mousemove="updateCursor" @mouseup="handleMouseUp" @mouseleave="handleMouseUp" @click="handleClick">
            <g :transform="transformMatrix">
                <g v-for="(tile, idx) in visibleTiles" :key="idx" :transform="tile.transform">
                    <g ref="mapContentRef" v-html="mapSVG" />
                </g>
            </g>
        </svg>
        <div class="debug-overlay">
            <div>CamPos: ({{ camera.x.toFixed(2) }}, {{ camera.y.toFixed(2) }}, {{ camera.z.toFixed(2) }})</div>
            <div>CursorPos: ({{ cursorWorld.x.toFixed(2) }}, {{ cursorWorld.y.toFixed(2) }})</div>
            <div>YRange: [{{ yRange.min.toFixed(2) }}, {{ yRange.max.toFixed(2) }}]</div>
            <div>Zoom: {{ camera.z.toFixed(2) }}/{{ zmax.toFixed(2) }}</div>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, reactive, computed, nextTick } from 'vue';
import { store } from '../store.js';

const sen = 0.005;
const senmouse = 0.005;
const zoomsen = 0.005;
const zoomsenmouse = 0.02;
const edgethres_fac = 0.05;
const zmin = 2.0;
const lerpacc = 0.9;
const maphei = 509.39001;
const mapwid = 1400.16;

const camera = reactive({ x: 0, y: 0, z: 50 });
const vel = reactive({ x: 0, y: 0, z: 0 });
const mouseScreen = reactive({ x: 0, y: 0 });

const svgRef = ref(null);
const mapContentRef = ref(null);
const mapSVG = ref('');
const containerRef = ref(null);
const cursorWorld = reactive({ x: 0, y: 0 });

let animationFrame = null;
let arrowKeys = { left: false, right: false, up: false, down: false, pageUp: false, pageDown: false };

const fov = 60;
const fovRad = computed(() => (fov * Math.PI) / 180);
const zmax = computed(() => maphei / 2.0 / Math.tan(fovRad.value / 2.0));

const yRange = computed(() => {
    const ymin = camera.z * Math.tan(fovRad.value / 2.0);
    const ymax = maphei - camera.z * Math.tan(fovRad.value / 2.0);
    return { min: ymin, max: ymax };
});

//3d coords to 2d matrix
const transformMatrix = computed(() => {
    const container = containerRef.value;
    if (!container) return '';
    const screenW = container.clientWidth;
    const screenH = container.clientHeight;
    const scale = screenH / maphei * (zmax.value / camera.z);
    const tx = screenW / 2 - camera.x * scale;
    const ty = screenH / 2 - camera.y * scale;
    return `translate(${tx},${ty}) scale(${scale},${scale})`;
});

//idk why 2 tiles just wont work
const visibleTiles = computed(() => {
    const tiles = [];
    const centerTileX = Math.floor(camera.x / mapwid);
    tiles.push({ transform: `translate(${(centerTileX - 1) * mapwid}, 0)` });
    tiles.push({ transform: `translate(${centerTileX * mapwid}, 0)` });
    tiles.push({ transform: `translate(${(centerTileX + 1) * mapwid}, 0)` });
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
    mouseScreen.x = mouseX;
    mouseScreen.y = mouseY;
    const mousePos = { x: mouseX, y: mouseY };

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
    cursorWorld.x = rayOrigin.x + rayDir.x * t;
    cursorWorld.y = rayOrigin.y + rayDir.y * t;
}


function handleMouseDown(event) {
    //todo
    if (event.button === 2) event.preventDefault();
}

function handleMouseUp(event) {
    //todo
}

function handleClick(event) {
    const target = event.target;
    if (target.tagName === 'path' && target.closest('#provinces')) {
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
        store.clearHighlight();
        store.highlightedProvinces.add(provId);
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

    const zoomfacmouse = camera.z * zoomsenmouse;
    const delta = event.deltaY > 0 ? -1 : 1;

    vel.x += zoomvec.x * zoomfacmouse * delta;
    vel.y += zoomvec.y * zoomfacmouse * delta;
    vel.z += zoomvec.z * zoomfacmouse * delta;
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
        const edgethres = { x: view.x * edgethres_fac, y: view.y * edgethres_fac };
        const fac = camera.z * sen;
        const facmouse = camera.z * senmouse;

        const mx = mouseScreen.x;
        const my = mouseScreen.y;

        if (mx >= 0 && mx <= view.x && my >= 0 && my <= view.y) {
            if (mx < edgethres.x) vel.x += -facmouse * (1 - mx / edgethres.x);
            else if (mx > view.x - edgethres.x) vel.x += facmouse * (1 - (view.x - mx) / edgethres.x);

            if (my < edgethres.y) vel.y += -facmouse * (1 - my / edgethres.y);
            else if (my > view.y - edgethres.y) vel.y += facmouse * (1 - (view.y - my) / edgethres.y);
        }

        if (arrowKeys.left) vel.x -= fac;
        if (arrowKeys.right) vel.x += fac;
        if (arrowKeys.up) vel.y += fac;
        if (arrowKeys.down) vel.y -= fac;
        if (arrowKeys.pageUp) vel.z -= camera.z * zoomsen;
        if (arrowKeys.pageDown) vel.z += camera.z * zoomsen;

        const newpos = {
            x: camera.x + vel.x,
            y: camera.y + vel.y,
            z: camera.z + vel.z
        };

        //wrap x coord for seamless scrolling
        if (newpos.x > mapwid / 2.0) newpos.x -= mapwid;
        else if (newpos.x < -mapwid / 2.0) newpos.x += mapwid;

        //clamp y and z
        newpos.y = Math.max(yRange.value.min, Math.min(newpos.y, yRange.value.max));
        newpos.z = Math.max(zmin, Math.min(newpos.z, zmax.value));

        camera.x = newpos.x;
        camera.y = newpos.y;
        camera.z = newpos.z;

        //vel decay exponentially
        vel.x *= lerpacc;
        vel.y *= lerpacc;
        vel.z *= lerpacc;

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

    // Init cam pos
    camera.x = 0;
    camera.y = maphei / 2;
    camera.z = 100;

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
    position: relative;
    background: #ffffff;
    background: radial-gradient(circle, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 1) 6%, rgba(0, 70, 128, 1) 10%, rgba(0, 6, 97, 1) 100%);
}

.map-svg {
    width: 100%;
    height: 100%;
    cursor: grab;
}

.map-svg:active {
    cursor: grabbing;
}

.selection-rect {
    fill: rgba(25, 118, 210, 0.3);
    stroke: rgba(25, 118, 210, 0.8);
    stroke-width: 1;
    pointer-events: none;
}

.debug-overlay {
    position: absolute;
    top: 8px;
    left: 8px;
    background: rgba(0, 0, 0, 0.7);
    color: #fff;
    font-size: 13px;
    padding: 8px 12px;
    border-radius: 8px;
    z-index: 2000;
    pointer-events: none;
    user-select: text;
    font-family: monospace;
    min-width: 220px;
}

@keyframes blink-gold {

    0%,
    50% {
        fill: #ffd700;
    }

    51%,
    100% {
        fill: #ffed4e;
    }
}
</style>