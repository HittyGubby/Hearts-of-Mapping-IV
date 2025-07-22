<template>
    <div class="relative w-screen h-screen overflow-hidden">
        <div class="absolute inset-0 z-0 w-screen h-screen">
            <MapView />
        </div>

        <div class="absolute top-4 left-4 z-10">
            <TopLeftUI />
        </div>

        <div class="absolute bottom-4 left-4 z-10">
            <BottomLeftUI />
        </div>

        <div class="absolute bottom-4 right-4 z-10">
            <BottomRightUI />
        </div>

        <transition name="slide-fade">
            <CountrySidebar v-if="store.showCountrySidebar" />
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
import CountrySidebar from '../components/CountrySidebar.vue';
import SettingsModal from '../components/SettingsModal.vue';

const handleKeyDown = (e) => {
    if (e.key === 'F1') {
        e.preventDefault();
        store.setMode('paint');
    } else if (e.key === 'F2') {
        e.preventDefault();
        store.setMode('erase');
    } else if (e.key === 'F3') {
        e.preventDefault();
        store.setMode('select');
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