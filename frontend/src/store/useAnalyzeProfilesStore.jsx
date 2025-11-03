import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';
import { format, startOfDay, endOfDay } from 'date-fns';


const getDefaultProfileState = () => ({
    selectedYear: 'Overall',
    activeTab: 'Overview',
    availableYears: ['Overall'],
    isLoadingYears: false,

    dateRange: undefined,
    selectedMonth: 4,
    selectedSeason: 'Monsoon',

});

export const useAnalyzeProfilesStore = create(persist((set, get) => ({
    // --- State Variables ---
    availableProfiles: [],
    selectedProfile: '',
    isLoadingProfiles: false,
    profilesState: {},
    projectPathForPersistedState: '',


    updateCurrentProfileState: (updates) => {
        const selectedProfile = get().selectedProfile;
        if (!selectedProfile) return;

        set((state) => ({
            profilesState: {
                ...state.profilesState,
                [selectedProfile]: {
                    ...(state.profilesState[selectedProfile] || getDefaultProfileState()),
                    ...updates,
                },
            },
        }));
    },

    fetchProfiles: async (projectPath) => {
        if (!projectPath) return;

        // Clear old profile states if switching to a new project.
        if (projectPath !== get().projectPathForPersistedState) {
            set({ profilesState: {}, selectedProfile: '', projectPathForPersistedState: projectPath });
        }

        set({ isLoadingProfiles: true });
        try {
            const response = await axios.get(`/project/load-profiles?projectPath=${encodeURIComponent(projectPath)}`);
            const profiles = response.data.profiles || [];
            const currentState = get();

            let newSelectedProfile = currentState.selectedProfile;
            // If no profile is selected, or if the previously selected profile doesn't exist in the new list, select the first one.
            if (!newSelectedProfile || !profiles.includes(newSelectedProfile)) {
                newSelectedProfile = profiles[0] || '';
            }

            set({ availableProfiles: profiles, selectedProfile: newSelectedProfile, isLoadingProfiles: false });

            // Trigger year fetching for the active profile if necessary.
            if (newSelectedProfile) {
                const profileState = currentState.profilesState[newSelectedProfile];
                if (!profileState || profileState.availableYears.length <= 1) { // <= 1 because it might only contain 'Overall' default
                    await get().fetchYears(projectPath, newSelectedProfile);
                }
            }
        } catch (error) {
            console.error("Failed to fetch load profiles:", error);
            set({ isLoadingProfiles: false, availableProfiles: [] });
        }
    },


    fetchYears: async (projectPath, profileName) => {
        if (!profileName || !projectPath) return;
        get().updateCurrentProfileState({ isLoadingYears: true });

        try {
            const response = await axios.get(`/project/profile-years`, { params: { projectPath, profileName } });
            const years = response.data.years || [];
            const newAvailableYears = ['Overall', ...years];
            const existingState = get().profilesState[profileName] || getDefaultProfileState();

            // Retain selection if valid, otherwise default to 'Overall'
            const newSelectedYear = newAvailableYears.includes(existingState.selectedYear)
                ? existingState.selectedYear
                : 'Overall';

            get().updateCurrentProfileState({
                availableYears: newAvailableYears,
                selectedYear: newSelectedYear,
                isLoadingYears: false
            });
        } catch (error) {
            console.error("Failed to fetch profile years:", error);
            get().updateCurrentProfileState({ isLoadingYears: false, availableYears: ['Overall'] });
        }
    },


    setSelectedProfile: (profileName, projectPath) => {
        const currentState = get();
        const existingState = currentState.profilesState[profileName];
        set({ selectedProfile: profileName });

        if (!existingState || !existingState.availableYears || existingState.availableYears.length <= 1) {
            currentState.fetchYears(projectPath, profileName);
        }
    },
}), {
    name: 'analyze-profiles-storage',
}));