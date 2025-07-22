<template>
    <v-card
        class="floating-card compact-card"
        elevation="8"
        color="rgba(30, 30, 30, 0.9)"
        backdrop-filter="blur(10px)"
        border
    >
        <v-card-item class="pa-3">
            <div class="d-flex align-center gap-2">
                <div
                    class="flag-container cursor-pointer"
                    @click="store.showCountrySidebar = !store.showCountrySidebar"
                >
                    <v-img
                        :src="selectedCountry.flag"
                        :alt="selectedCountry.name"
                        width="48"
                        height="32"
                        cover
                        class="flag-image"
                    />
                </div>
                
                <div class="flex-grow-1 min-width-0">
                    <div class="text-subtitle-2 font-weight-bold text-truncate">
                        {{ selectedCountry.name }}
                    </div>
                    <div class="text-caption text-medium-emphasis">
                        {{ store.selectedCountryId }}
                    </div>
                </div>

                <v-btn
                    icon="mdi-chevron-right"
                    variant="text"
                    size="small"
                    @click="store.showCountrySidebar = !store.showCountrySidebar"
                    class="ml-1"
                />
            </div>
        </v-card-item>
    </v-card>
</template>

<script setup>
import { computed } from 'vue';
import { store } from '../store';

const selectedCountry = computed(() => {
    if (!store.selectedCountryId || !store.countries[store.selectedCountryId]) {
        return {
            name: "No Country Selected",
            flag: "flags/GER.png" // Default flag
        };
    }
    return store.countries[store.selectedCountryId];
});
</script>

<style scoped>
.floating-card {
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition: all 0.3s ease;
    max-width: 200px;
}

.compact-card {
    width: fit-content;
}

.floating-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
}

.cursor-pointer {
    cursor: pointer;
}

.flag-container {
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    overflow: hidden;
    transition: all 0.3s ease;
}

.flag-container:hover {
    border-color: rgba(255, 255, 255, 0.5);
    transform: scale(1.05);
}

.flag-image {
    border-radius: 0;
}

.min-width-0 {
    min-width: 0;
}

.text-truncate {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
</style>