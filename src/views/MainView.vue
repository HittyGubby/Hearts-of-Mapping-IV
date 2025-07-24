<template>
    <div class="absolute w-screen h-screen">
        <div class="absolute inset-0 z-0 w-screen h-screen">
            <MapView />
        </div>

        <div style="position: absolute; top: 0; left: 0; z-index: 10;">
            <TopLeftUI />
        </div>

        <div style="position: absolute; bottom: 0; left: 0; z-index: 10;">
            <BottomLeftUI />
        </div>

        <div style="position: absolute; bottom: 0; right: 0; z-index: 10;">
            <BottomRightUI />
        </div>

        <div style="position: absolute; top: 0; right: 0; z-index: 10;">
            <TopRightUI />
        </div>

        <transition name="slide-fade">
            <div>
                <CountrySidebar v-if="store.showCountrySidebar" />
            </div>
        </transition>

        <transition name="fade">
            <SettingsModal v-if="store.showSettingsModal" />
        </transition>
    </div>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue';
import { store } from '../store';
import MapView from '../components/MapView.vue';
import TopLeftUI from '../components/TopLeftUI.vue';
import BottomLeftUI from '../components/BottomLeftUI.vue';
import BottomRightUI from '../components/BottomRightUI.vue';
import TopRightUI from '../components/TopRightUI.vue';
import CountrySidebar from '../components/CountrySidebar.vue';
import SettingsModal from '../components/PauseMenu.vue';

const handleKeyDown = (e) => {
    if (store.currentScreen == 'main' && !store.showCountrySidebar && !store.showSettingsModal) {
        e.preventDefault();
        if (e.key === 'F1') {
            store.setMode('paint');
        } else if (e.key === 'F2') {
            store.setMode('erase');
        } else if (e.key === 'F3') {
            store.setMode('select');
        } else if (e.key === 'Escape') {
            store.showSettingsModal = !store.showSettingsModal;
        } else if (e.key === '`') {
            store.showDebugInfo = !store.showDebugInfo;
        }
    }
};

onMounted(() => {
    window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown);
});
</script>

<style scoped>
.slide-fade-enter-active,
.slide-fade-leave-active {
    transition: all 0.3s ease;
}

.slide-fade-enter-from {
    transform: translateX(-100%);
    opacity: 0;
}

.slide-fade-leave-to {
    transform: translateX(-100%);
    opacity: 0;
}

.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}
</style>