<template>
    <v-btn density="comfortable" icon="mdi-tune" color="dark" elevation="5" @click="store.showSettingsModal = true"
        class="floating-btn block" style="border-radius: 8px; color: orange;">
    </v-btn>

</template>

<script setup>
import { store } from '../store';
</script>

<style scoped>
.floating-btn {
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition: all 0.3s ease;
}

.floating-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
}
</style>