<template>
    <div class="d-flex flex-column align-end gap-2">
        <!-- Settings Button -->
        <v-btn
            icon="mdi-cog"
            size="large"
            color="primary"
            variant="elevated"
            elevation="8"
            @click="store.showSettingsModal = true"
            class="floating-btn"
        />

        <!-- View Mode Buttons -->
        <v-card
            class="floating-card"
            elevation="8"
            color="rgba(30, 30, 30, 0.9)"
            backdrop-filter="blur(10px)"
            border
        >
            <v-card-item class="pa-3">
                <v-btn-group
                    variant="tonal"
                    class="d-flex"
                >
                    <v-btn
                        color="primary"
                        variant="elevated"
                        size="small"
                        class="px-3"
                    >
                        Political
                    </v-btn>

                    <v-btn
                        variant="tonal"
                        size="small"
                        class="px-3"
                        disabled
                    >
                        Faction
                    </v-btn>

                    <v-btn
                        variant="tonal"
                        size="small"
                        class="px-3"
                        disabled
                    >
                        Flags
                    </v-btn>
                </v-btn-group>
            </v-card-item>
        </v-card>
    </div>
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
    transform: translateY(-2px) rotate(90deg);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
}

.floating-card {
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition: all 0.3s ease;
}

.floating-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
}

.v-btn-group {
    border-radius: 8px;
    overflow: hidden;
}

.v-btn-group .v-btn {
    border-radius: 0;
    min-width: auto;
}

.v-btn-group .v-btn:first-child {
    border-top-left-radius: 8px;
    border-bottom-left-radius: 8px;
}

.v-btn-group .v-btn:last-child {
    border-top-right-radius: 8px;
    border-bottom-right-radius: 8px;
}
</style>