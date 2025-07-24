<template>
    <v-navigation-drawer v-model="isOpen" location="left" width="320" temporary class="country-sidebar" elevation="16">
        <v-toolbar color="primary" dark flat>
            <v-toolbar-title class="text-h6 font-weight-bold">
                Countries
            </v-toolbar-title>
            <v-spacer />
            <v-btn icon="mdi-close" variant="text" @click="store.showCountrySidebar = false" />
        </v-toolbar>

        <v-list class="pa-0">
            <v-list-item v-for="(country, id) in store.countries" :key="id" @click="store.selectCountry(id)"
                :active="store.selectedCountryId === id" class="country-item"
                :class="{ 'selected-country': store.selectedCountryId === id }">
                <template v-slot:prepend>
                    <div class="flag-container mr-3">
                        <v-img :src="country.flag" :alt="country.name" width="48" height="32" cover
                            class="flag-image" />
                    </div>
                </template>

                <v-list-item-title class="font-weight-medium">
                    {{ country.name }}
                </v-list-item-title>

                <v-list-item-subtitle class="text-caption">
                    ID: {{ id }} | Provinces: {{ country.provinces.length }}
                </v-list-item-subtitle>

                <template v-slot:append>
                    <v-menu>
                        <template v-slot:activator="{ props }">
                            <v-btn icon="mdi-dots-vertical" variant="text" size="small" v-bind="props" @click.stop />
                        </template>
                        <v-list>
                            <v-list-item @click="editCountry(id)">
                                <v-list-item-title>
                                    <v-icon start>mdi-pencil</v-icon>
                                    Edit
                                </v-list-item-title>
                            </v-list-item>
                            <v-list-item @click="deleteCountry(id)" color="error">
                                <v-list-item-title>
                                    <v-icon start>mdi-delete</v-icon>
                                    Delete
                                </v-list-item-title>
                            </v-list-item>
                        </v-list>
                    </v-menu>
                </template>
            </v-list-item>
        </v-list>

        <template v-slot:append>
            <div class="pa-4">
                <v-divider class="mb-3" />

                <!-- Add Country Button -->
                <v-btn block color="success" variant="elevated" @click="showAddCountryDialog = true" class="mb-3">
                    <v-icon start>mdi-plus</v-icon>
                    Add Country
                </v-btn>
            </div>
        </template>
    </v-navigation-drawer>

    <!-- Add/Edit Country Dialog -->
    <v-dialog v-model="showAddCountryDialog" max-width="500">
        <v-card>
            <v-toolbar color="primary" dark flat>
                <v-toolbar-title>
                    {{ editingCountry ? 'Edit Country' : 'Add Country' }}
                </v-toolbar-title>
                <v-spacer />
                <v-btn icon="mdi-close" variant="text" @click="showAddCountryDialog = false" />
            </v-toolbar>

            <v-card-text class="pa-6">
                <v-form ref="form">
                    <v-text-field v-model="countryForm.id" label="Country ID" required
                        :rules="[v => !!v || 'Country ID is required']" :disabled="editingCountry" />

                    <v-text-field v-model="countryForm.name" label="Country Name" required
                        :rules="[v => !!v || 'Country name is required']" />

                    <v-text-field v-model="countryForm.flag" label="Flag URL (Optional, Online or local)" />

                    <v-color-picker v-model="countryForm.color" label="Country Color" hide-inputs class="mt-4" />
                </v-form>
            </v-card-text>

            <v-card-actions class="pa-6">
                <v-spacer />
                <v-btn variant="text" @click="showAddCountryDialog = false">
                    Cancel
                </v-btn>
                <v-btn color="primary" @click="saveCountry">
                    {{ editingCountry ? 'Update' : 'Add' }}
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script setup>
import { computed, ref, reactive } from 'vue';
import { store } from '../store';

const isOpen = computed({
    get: () => store.showCountrySidebar,
    set: (value) => store.showCountrySidebar = value
});

const showAddCountryDialog = ref(false);
const editingCountry = ref(null);
const form = ref(null);

const countryForm = reactive({
    id: '',
    name: '',
    flag: '',
    color: '#1976D2'
});

function editCountry(id) {
    const country = store.countries[id];
    editingCountry.value = id;
    countryForm.id = id;
    countryForm.name = country.name;
    countryForm.flag = country.flag;
    countryForm.color = country.color;
    showAddCountryDialog.value = true;
}

function deleteCountry(id) {
    if (confirm(`Are you sure you want to delete ${store.countries[id].name}?`)) {
        delete store.countries[id];
        if (store.selectedCountryId === id) {
            const firstCountry = Object.keys(store.countries)[0];
            if (firstCountry) {
                store.selectedCountryId = firstCountry;
            }
        }
    }
}

async function saveCountry() {
    if (!form.value.validate()) return;

    if (editingCountry.value) {
        // Update existing country
        store.countries[countryForm.id] = {
            name: countryForm.name,
            flag: countryForm.flag,
            color: countryForm.color,
            provinces: store.countries[countryForm.id].provinces
        };
    } else {
        // Add new country
        store.countries[countryForm.id] = {
            name: countryForm.name,
            flag: countryForm.flag,
            color: countryForm.color,
            provinces: []
        };
    }
    store.selectedCountryId = countryForm.id;
    showAddCountryDialog.value = false;
    editingCountry.value = null;
    resetForm();
}

function resetForm() {
    countryForm.id = '';
    countryForm.name = '';
    countryForm.flag = '';
    countryForm.color = '#1976D2';
}
</script>

<style scoped>
.country-sidebar {
    backdrop-filter: blur(10px);
    background: rgba(30, 30, 30, 0.95) !important;
}

.country-item {
    margin: 4px 8px;
    border-radius: 8px;
    transition: all 0.3s ease;
}

.country-item:hover {
    background: rgba(255, 255, 255, 0.05);
    transform: translateX(4px);
}

.selected-country {
    background: rgba(25, 118, 210, 0.2) !important;
    border-left: 4px solid rgb(25, 118, 210);
}

.flag-container {
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    overflow: hidden;
}

.flag-image {
    border-radius: 0;
}
</style>