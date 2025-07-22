<template>
    <v-card
        class="floating-card compact-card"
        elevation="8"
        color="rgba(30, 30, 30, 0.9)"
        backdrop-filter="blur(10px)"
        border
    >
        <v-card-item class="pa-2">
            <v-btn-group
                variant="tonal"
                class="d-flex"
            >
                <v-btn
                    :color="store.mode === 'paint' ? 'primary' : undefined"
                    :variant="store.mode === 'paint' ? 'elevated' : 'tonal'"
                    @click="store.setMode('paint')"
                    size="small"
                    class="px-3"
                >
                    <v-icon start size="small">mdi-brush</v-icon>
                    <span class="d-none d-md-inline ml-1">Paint</span>
                </v-btn>

                <v-btn
                    :color="store.mode === 'erase' ? 'error' : undefined"
                    :variant="store.mode === 'erase' ? 'elevated' : 'tonal'"
                    @click="store.setMode('erase')"
                    size="small"
                    class="px-3"
                >
                    <v-icon start size="small">mdi-eraser</v-icon>
                    <span class="d-none d-md-inline ml-1">Erase</span>
                </v-btn>

                <v-btn
                    :color="store.mode === 'select' ? 'info' : undefined"
                    :variant="store.mode === 'select' ? 'elevated' : 'tonal'"
                    @click="store.setMode('select')"
                    size="small"
                    class="px-3"
                >
                    <v-icon start size="small">mdi-cursor-pointer</v-icon>
                    <span class="d-none d-md-inline ml-1">Select</span>
                </v-btn>
            </v-btn-group>
        </v-card-item>
    </v-card>
</template>

<script setup>
import { store } from '../store';
</script>

<style scoped>
.floating-card {
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition: all 0.3s ease;
}

.compact-card {
    width: fit-content;
}

.floating-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
}

.v-btn-group {
    border-radius: 6px;
    overflow: hidden;
}

.v-btn-group .v-btn {
    border-radius: 0;
    min-width: auto;
}

.v-btn-group .v-btn:first-child {
    border-top-left-radius: 6px;
    border-bottom-left-radius: 6px;
}

.v-btn-group .v-btn:last-child {
    border-top-right-radius: 6px;
    border-bottom-right-radius: 6px;
}
</style>