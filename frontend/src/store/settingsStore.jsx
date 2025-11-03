

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';
// Removed toast import as requested

// Define the default colors here so they are consistent
const defaultColorConfig = {
    sectors: {},
    models: {
        'SLR': '#60a5fa',
        'WAM': '#f472b6',
        'MLR': '#34d399',
        'Time Series': '#facc15',
    },
};

const defaultSectorColors = [
    '#3b82f6', '#ec4899', '#10b981', '#f59e0b',
    '#8b5cf6', '#f97316', '#a855f7', '#14b8a6'
];

export const useSettingsStore = create(persist((set, get) => ({
    colorConfig: defaultColorConfig,
    persistedProjectPath: null, 

    fetchColorConfig: async (projectPath, sectors = []) => {
        
        // stop here. This prevents overwriting unsaved changes on page refresh.
        if (projectPath === get().persistedProjectPath) {
            return;
        }

        // If it's a new project, fetch its data from the server file.
        if (!projectPath) {
            set({ colorConfig: defaultColorConfig, persistedProjectPath: null });
            return;
        }
        try {
            const res = await axios.get(`/project/settings/colors?projectPath=${encodeURIComponent(projectPath)}`);
            set({ 
                colorConfig: { ...defaultColorConfig, ...res.data, sectors: { ...res.data.sectors } },
                persistedProjectPath: projectPath // Store the path of the loaded project
            });
        } catch (error) {
            console.log('No existing color config found, generating defaults based on current project sectors.');
            const newSectorColors = {};
            sectors.forEach((sector, index) => {
                newSectorColors[sector] = defaultSectorColors[index % defaultSectorColors.length];
            });
            set({ 
                colorConfig: { ...defaultColorConfig, sectors: newSectorColors },
                persistedProjectPath: projectPath // Store the path of the loaded project even on failure/defaults generation
            });
        }
    },

    updateColor: (type, key, value) => {
        set((state) => ({
            colorConfig: {
                ...state.colorConfig,
                [type]: { ...state.colorConfig[type], [key]: value },
            },
        }));
    },

    saveColorConfig: async (projectPath) => {
        if (!projectPath) return;
        const { colorConfig } = get();
        try {
            await axios.post('/project/settings/save-colors', { projectPath, colorConfig });
        } catch (err) {
            console.error('Error saving color settings:', err);
            throw err; 
        }
    },
}), {
    name: 'color-settings-storage', 
}));