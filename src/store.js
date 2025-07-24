import { reactive, watch } from "vue";
import { documentDir } from "@tauri-apps/api/path";
import { readTextFile } from "@tauri-apps/plugin-fs";

export const store = reactive({
  // App State
  currentScreen: "starter", // 'starter' or 'main'
  mapType: "vanilla",

  // UI State
  mode: "paint", // 'paint', 'erase', 'select'
  showCountrySidebar: false,
  showSettingsModal: false,
  showDebugInfo: true,

  // Map Data
  countries: {
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
  },
  factions: {
    allies: { name: "Allies", members: ["USA"] },
  },

  // Selection State
  selectedCountryId: undefined,
  highlightedProvinces: new Set(),
  clickedProvinceId: undefined,

  // --- ACTIONS ---

  setMode(newMode) {
    this.mode = newMode;
  },

  selectCountry(countryId) {
    this.selectedCountryId = countryId;
    this.mode = "paint"; // Default to paint mode on new selection
  },

  getProvinceOwner(provId) {
    for (const [cid, c] of Object.entries(this.countries)) {
      if (c.provinces.includes(provId)) return cid;
    }
    return null;
  },

  setHighlightByCountry(cid) {
    this.highlightedProvinces.clear();
    if (!cid) return;
    for (const prov of this.countries[cid]?.provinces || []) {
      this.highlightedProvinces.add(prov);
    }
    for (const [otherId, country] of Object.entries(this.countries)) {
      if (otherId !== cid && this.factionsAreAllied(cid, otherId)) {
        for (const prov of country.provinces) {
          this.highlightedProvinces.add(prov); // green
        }
      }
    }
  },

  assignProvince(provinceId, countryId) {
    //remove from old owner
    for (const id in this.countries) {
      const country = this.countries[id];
      const index = country.provinces.indexOf(provinceId);
      if (index > -1) {
        country.provinces.splice(index, 1);
        break;
      }
    }
    //assign to new owner
    if (countryId && this.countries[countryId]) {
      console.log(provinceId, countryId);
      this.countries[countryId].provinces.push(provinceId);
      this.highlightedProvinces.add(provinceId);
    }
  },

  clearHighlight() {
    this.highlightedProvinces.clear();
  },

  async saveState(fileName) {
    try {
      const docDir = await documentDir();
      const path = `${docDir}Hoi4MapEditor/${fileName}.json`;

      const stateToSave = {
        mapType: this.mapType,
        countries: this.countries,
        factions: this.factions,
        uiState: {
          selectedCountryId: this.selectedCountryId,
          mode: this.mode,
        },
      };

      await createDir("Hearts-of-Mapping-IV", {
        baseDir: BaseDirectory.Document,
        recursive: true,
      });
      await writeTextFile(path, JSON.stringify(stateToSave, null, 2));
      await dialog.message("Project saved successfully!", { title: "Success" });
      return true;
    } catch (error) {
      console.error("Failed to save state:", error);
      await dialog.message(`Error saving file: ${error}`, {
        title: "Save Error",
        type: "error",
      });
      return false;
    }
  },

  async loadState() {
    try {
      const selected = await dialog.open({
        multiple: false,
        directory: false,
        filters: [{ name: "JSON", extensions: ["json"] }],
        defaultPath: await documentDir(),
      });

      if (typeof selected === "string") {
        const fileContents = await readTextFile(selected);
        const loadedData = JSON.parse(fileContents);

        // Load data into store
        this.mapType = loadedData.mapType;
        this.countries = loadedData.countries;
        this.factions = loadedData.factions;
        this.selectedCountryId = loadedData.uiState.selectedCountryId;
        this.mode = loadedData.uiState.mode;

        console.log(`State loaded from ${selected}`);
        this.currentScreen = "main"; // Switch to main view after loading
        return true;
      }
    } catch (error) {
      console.error("Failed to load state:", error);
      await dialog.message(`Error loading file: ${error}`, {
        title: "Load Error",
        type: "error",
      });
      return false;
    }
  },
});
