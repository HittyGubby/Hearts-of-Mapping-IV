<template>
    <v-dialog v-model="isOpen" max-width="200" class="settings-dialog">
        <v-card class="settings-card" elevation="24">
            <v-card-text class="pa-2">
                <v-btn block color="blue" variant="elevated" @click="handleSave" class="mb-1 text-none"
                    density="comfortable">
                    Save
                </v-btn>
                <v-btn block color="blue" variant="elevated" @click="handleLoad" class="mb-1 text-none"
                    density="comfortable">
                    Load
                </v-btn>
                <v-btn block color="success" variant="elevated" @click="handleSettings" class="mb-1 text-none"
                    density="comfortable">
                    Settings
                </v-btn>
                <v-btn block color="primary" variant="elevated" @click="handleExitToStart" class="mb-1 text-none"
                    density="comfortable">
                    Exit to Main Menu
                </v-btn>
                <v-btn block color="primary" variant="elevated" @click="handleExit" class="mb-1 text-none"
                    density="comfortable">
                    Exit Application
                </v-btn>
                <v-btn block color="secondary" variant="elevated" @click="handleClose" class="mb-1 text-none"
                    density="comfortable">
                    Close
                </v-btn>
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
        store.showSettingsModal = false;
    }
};

const handleExit = async () => {
    if (await dialog.confirm('Are you sure you want to exit? Any unsaved changes will be lost.', { title: 'Confirm Exit', type: 'warning' })) {
        await process.exit(0);
    }
};

const handleExitToStart = async () => {
    if (await dialog.confirm('Are you sure you want to exit to the start screen? Any unsaved changes will be lost.', { title: 'Confirm Exit', type: 'warning' })) {
        store.resetState();
        store.showSettingsModal = false;
    }
};

const handleClose = () => {
    store.showSettingsModal = false;
};
</script>

<style scoped>
.v-btn {
    font-family: Pure, Heiti;
}
</style>