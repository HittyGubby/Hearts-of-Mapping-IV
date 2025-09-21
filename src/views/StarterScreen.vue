<template>
    <div class="starter-screen">
        <v-container fluid class="fill-height">
            <v-row justify="center" align="center">
                <v-col cols="12" sm="8" md="6" lg="4">
                    <v-card class="welcome-card" elevation="24" color="rgba(30, 30, 30, 0.9)"
                        backdrop-filter="blur(10px)" border>
                        <v-card-item class="text-center pa-8">
                            <v-icon size="64" color="primary" class="mb-4">
                                mdi-map
                            </v-icon>

                            <v-card-title class="text-h3 font-weight-bold mb-2">
                                Map Editor
                            </v-card-title>

                            <v-card-subtitle class="text-h6 text-medium-emphasis mb-8">
                                {{ showPresets ? 'Select a Preset' : 'Select a Map or Load a Project' }}
                            </v-card-subtitle>

                            <div v-if="!showPresets" class="space-y-4">
                                <v-btn block size="large" color="primary" variant="elevated"
                                    @click="selectMap('vanilla')" class="map-btn">
                                    <v-icon start>mdi-earth</v-icon>
                                    <div class="text-left">
                                        <div class="text-h6 font-weight-medium">Vanilla Map</div>
                                        <div class="text-caption">The standard game map</div>
                                    </div>
                                </v-btn>

                                <v-btn block size="large" variant="tonal" disabled class="map-btn">
                                    <v-icon start>mdi-earth-off</v-icon>
                                    <div class="text-left">
                                        <div class="text-h6 font-weight-medium">The New Order</div>
                                        <div class="text-caption">TNO Mod Map (coming soon)</div>
                                    </div>
                                </v-btn>

                                <v-divider class="my-6" />

                                <v-btn block size="large" color="secondary" variant="elevated"
                                    @click="store.loadState()" class="load-btn">
                                    <v-icon start>mdi-folder-open</v-icon>
                                    Load Project File
                                </v-btn>
                            </div>

                            <div v-else class="space-y-4">
                                <v-btn block size="large" color="blue" variant="elevated" @click="startEmpty()"
                                    class="preset-btn">
                                    <v-icon start>mdi-plus-circle</v-icon>
                                    <div class="text-left">
                                        <div class="text-h6 font-weight-medium">Empty Map</div>
                                        <div class="text-caption">Start with a blank slate</div>
                                    </div>
                                </v-btn>

                                <v-btn block size="large" color="blue" variant="elevated" @click="startWithHistory()"
                                    class="preset-btn">
                                    <v-icon start>mdi-history</v-icon>
                                    <div class="text-left">
                                        <div class="text-h6 font-weight-medium">Game History</div>
                                        <div class="text-caption">Pre-populated with historical countries</div>
                                    </div>
                                </v-btn>

                                <v-divider class="my-6" />

                                <v-btn block size="large" color="secondary" variant="tonal" @click="showPresets = false"
                                    class="back-btn">
                                    <v-icon start>mdi-arrow-left</v-icon>
                                    Back to Map Selection
                                </v-btn>
                            </div>
                        </v-card-item>
                    </v-card>
                </v-col>
            </v-row>
        </v-container>
    </div>
</template>

<script setup>
import { ref } from 'vue';
import { store } from '../store';

const showPresets = ref(false);

function selectMap(mapType) {
    store.mapType = mapType;
    showPresets.value = true;
}

function startEmpty() {
    // Clear all countries and start fresh
    store.countries = {};
    store.selectedCountryId = null;
    store.currentScreen = 'main';
}

function startWithHistory() {
    // Initialize with historical countries
    store.countries = {
        GER: {
            name: "Germany",
            color: "#555555",
            flag: "flags/GER.png",
            provinces: [],
        },
        POL: {
            name: "Poland",
            color: "#ffb3b3",
            flag: "flags/POL.png",
            provinces: [],
        },
        USA: {
            name: "United States",
            color: "#6c8ed6",
            flag: "flags/USA.png",
            provinces: [],
        },
        FRA: {
            name: "France",
            color: "#4a90e2",
            flag: "flags/FRA.png",
            provinces: [],
        },
        GBR: {
            name: "United Kingdom",
            color: "#d0021b",
            flag: "flags/GBR.png",
            provinces: [],
        },
        SOV: {
            name: "Soviet Union",
            color: "#ff0000",
            flag: "flags/SOV.png",
            provinces: [],
        },
        ITA: {
            name: "Italy",
            color: "#009246",
            flag: "flags/ITA.png",
            provinces: [],
        },
        JAP: {
            name: "Japan",
            color: "#bc002d",
            flag: "flags/JAP.png",
            provinces: [],
        }
    };
    store.selectedCountryId = "GER";
    store.currentScreen = 'main';
}
</script>

<style scoped>
.starter-screen {
    background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
    min-height: 100vh;
    position: relative;
}

.starter-screen::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    opacity: 0.1;
    z-index: 0;
}

.welcome-card {
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition: all 0.3s ease;
    z-index: 1;
    position: relative;
}

.welcome-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
}

.map-btn,
.preset-btn {
    height: auto !important;
    padding: 16px !important;
    justify-content: flex-start;
    transition: all 0.3s ease;
}

.map-btn:hover:not(:disabled),
.preset-btn:hover {
    transform: translateX(8px);
}

.load-btn,
.back-btn {
    transition: all 0.3s ease;
}

.load-btn:hover,
.back-btn:hover {
    transform: scale(1.02);
}

.space-y-4>*+* {
    margin-top: 1rem;
}
</style>