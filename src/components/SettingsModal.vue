<template>
    <v-dialog
        v-model="isOpen"
        max-width="500"
        persistent
        class="settings-dialog"
    >
        <v-card
            class="settings-card"
            elevation="24"
        >
            <v-toolbar
                color="primary"
                dark
                flat
            >
                <v-toolbar-title class="text-h6 font-weight-bold">
                    <v-icon start>mdi-cog</v-icon>
                    Settings
                </v-toolbar-title>
                <v-spacer />
                <v-btn
                    icon="mdi-close"
                    variant="text"
                    @click="store.showSettingsModal = false"
                />
            </v-toolbar>

            <v-card-text class="pa-6">
                <div class="space-y-6">
                    <!-- Project Section -->
                    <div>
                        <v-card-title class="text-h6 font-weight-medium pa-0 mb-4">
                            <v-icon start color="primary">mdi-folder</v-icon>
                            Project
                        </v-card-title>
                        
                        <v-row>
                            <v-col cols="6">
                                <v-btn
                                    block
                                    color="primary"
                                    variant="elevated"
                                    @click="handleSave"
                                    class="mb-2"
                                >
                                    <v-icon start>mdi-content-save</v-icon>
                                    Save Project
                                </v-btn>
                            </v-col>
                            <v-col cols="6">
                                <v-btn
                                    block
                                    color="secondary"
                                    variant="elevated"
                                    @click="handleLoad"
                                    class="mb-2"
                                >
                                    <v-icon start>mdi-folder-open</v-icon>
                                    Load Project
                                </v-btn>
                            </v-col>
                        </v-row>
                    </div>

                    <v-divider />

                    <!-- Application Section -->
                    <div>
                        <v-card-title class="text-h6 font-weight-medium pa-0 mb-4">
                            <v-icon start color="warning">mdi-application</v-icon>
                            Application
                        </v-card-title>
                        
                        <v-btn
                            block
                            color="error"
                            variant="elevated"
                            @click="handleExit"
                            class="mb-2"
                        >
                            <v-icon start>mdi-exit-to-app</v-icon>
                            Exit Application
                        </v-btn>
                    </div>

                    <v-divider />

                    <!-- Info Section -->
                    <v-card
                        color="info"
                        variant="tonal"
                        class="pa-4"
                    >
                        <div class="d-flex align-center">
                            <v-icon start color="info">mdi-information</v-icon>
                            <div>
                                <div class="text-subtitle-2 font-weight-medium">Keyboard Shortcuts</div>
                                <div class="text-caption">
                                    F1: Paint Mode | F2: Erase Mode | F3: Select Mode
                                </div>
                            </div>
                        </div>
                    </v-card>
                </div>
            </v-card-text>
        </v-card>
    </v-dialog>
</template>

<script setup>
import { computed } from 'vue';
import { store } from '../store';

const isOpen = computed({
    get: () => store.showSettingsModal,
    set: (value) => store.showSettingsModal = value
});

const handleSave = async () => {
    const now = new Date();
    const defaultName = `map-save-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const filePath = await dialog.save({
        defaultPath: defaultName,
        filters: [{
            name: 'JSON',
            extensions: ['json']
        }]
    });

    if (filePath) {
        // Remove extension if user added it, we'll add it
        const finalName = filePath.replace(/\.json$/, '').split(/[\\/]/).pop();
        if (await store.saveState(finalName)) {
            await dialog.message('Project saved successfully!', { title: 'Success' });
        }
    }
};

const handleLoad = async () => {
    if (await store.loadState()) {
        store.showSettingsModal = false; // Close modal on successful load
    }
};

const handleExit = async () => {
    if (await dialog.confirm('Are you sure you want to exit? Any unsaved changes will be lost.', { title: 'Confirm Exit', type: 'warning' })) {
        await process.exit(0);
    }
};
</script>

<style scoped>
.settings-dialog {
    backdrop-filter: blur(10px);
}

.settings-card {
    backdrop-filter: blur(10px);
    background: rgba(30, 30, 30, 0.95) !important;
    border: 1px solid rgba(255, 255, 255, 0.1);
}

.space-y-6 > * + * {
    margin-top: 1.5rem;
}
</style>