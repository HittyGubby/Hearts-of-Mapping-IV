<template>
  <v-app id="app-container" theme="dark">
    <v-main class="pa-0">
      <transition name="fade" mode="out-in">
        <StarterScreen v-if="store.currentScreen === 'starter'" />
        <MainView v-else />
      </transition>
    </v-main>
  </v-app>
</template>

<script setup>
import { store } from './store';
import StarterScreen from './views/StarterScreen.vue';
import MainView from './views/MainView.vue';
window.addEventListener('contextmenu', e => e.preventDefault());

</script>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Custom scrollbar for dark theme */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: #1E1E1E;
}

::-webkit-scrollbar-thumb {
  background: #424242;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #616161;
}
</style>