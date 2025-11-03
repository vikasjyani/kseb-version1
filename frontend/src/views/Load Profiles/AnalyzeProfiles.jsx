
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';
import ReactApexChart from 'react-apexcharts';
import {
    LayoutDashboard, LineChart as LineChartIcon, CalendarDays,
    CalendarCheck2, AreaChart, Loader2, AlertTriangle,
    Calendar, Moon, Sun
} from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { format, startOfDay, endOfDay } from 'date-fns'; // Make sure format is imported
import {
    LineChart as RechartsLineChart, Line, XAxis, YAxis, Tooltip, Legend,
    ResponsiveContainer, CartesianGrid, Brush
} from "recharts";

// =================================================================================
// == ZUSTAND STATE STORE ==========================================================
// =================================================================================

// Default state for a single profile when it's first selected or initialized.
const getDefaultProfileState = () => ({
    selectedYear: 'Overall',
    activeTab: 'Overview',
    availableYears: ['Overall'],
    isLoadingYears: false,

    // --- Persisted UI State ---
    // Time Series Tab State
    dateRange: undefined,
    selectedMonth: 4, // Default to April
    selectedSeason: 'Monsoon', // Default season

    // Overview Tab State (FOR PERSISTENCE)
    overviewMonthlyParam: 'Peak Demand',
    overviewSeasonalParam: 'Peak Demand',
    overviewMonthlyLowColor: '#cfd4e3',
    overviewMonthlyHighColor: '#252323',
    overviewSeasonalLowColor: '#cfd4e3',
    overviewSeasonalHighColor: '#252323',
});

export const useAnalyzeProfilesStore = create(persist((set, get) => ({
    // --- State Variables ---
    availableProfiles: [],
    selectedProfile: '',
    isLoadingProfiles: false,
    errorProfiles: '',
    profilesState: {}, // Nested object: { profileName1: { state1 }, profileName2: { state2 } }
    projectPathForPersistedState: '',

    // --- Actions ---
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
        if (projectPath !== get().projectPathForPersistedState) {
            set({ profilesState: {}, selectedProfile: '', projectPathForPersistedState: projectPath });
        }

        set({ isLoadingProfiles: true, errorProfiles: '' });
        try {
            const response = await axios.get(`/project/load-profiles?projectPath=${encodeURIComponent(projectPath)}`);
            const profiles = response.data.profiles || [];
            const currentState = get();

            let newSelectedProfile = currentState.selectedProfile;
            if (!newSelectedProfile || !profiles.includes(newSelectedProfile)) {
                newSelectedProfile = profiles[0] || '';
            }

            set({ availableProfiles: profiles, selectedProfile: newSelectedProfile, isLoadingProfiles: false });

            if (newSelectedProfile) {
                const profileState = currentState.profilesState[newSelectedProfile];
                if (!profileState || profileState.availableYears.length <= 1) {
                    await get().fetchYears(projectPath, newSelectedProfile);
                }
            }
        } catch (error) {
            console.error("Failed to fetch load profiles:", error);
            set({ isLoadingProfiles: false, availableProfiles: [], errorProfiles: error.message || "Failed to fetch load profiles." });
        }
    },

    fetchYears: async (projectPath, profileName) => {
        if (!profileName || !projectPath) return;
        set((state) => ({
            profilesState: {
                ...state.profilesState,
                [profileName]: {
                    ...(state.profilesState[profileName] || getDefaultProfileState()),
                    isLoadingYears: true,
                },
            },
        }));

        try {
            const response = await axios.get(`/project/profile-years`, { params: { projectPath, profileName } });
            const years = response.data.years || [];
            const newAvailableYears = ['Overall', ...years];
            const existingState = get().profilesState[profileName] || getDefaultProfileState();

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
        if (!currentState.profilesState[profileName]) {
            set((state) => ({
                profilesState: {
                    ...state.profilesState,
                    [profileName]: getDefaultProfileState(),
                },
            }));
        }
        set({ selectedProfile: profileName });

        const updatedState = get();
        const existingState = updatedState.profilesState[profileName];

        if (!existingState.availableYears || existingState.availableYears.length <= 1) {
            updatedState.fetchYears(projectPath, profileName);
        }
    },
}), {
    name: 'analyze-profiles-storage',
    storage: {
        getItem: (name) => {
            const str = localStorage.getItem(name);
            return str ? JSON.parse(str) : null;
        },
        setItem: (name, value) => {
            localStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: (name) => localStorage.removeItem(name),
    },
}));

// =================================================================================
// == REUSABLE CHART COMPONENTS ====================================================
// =================================================================================

// --- Heatmap Component (User Provided Implementation) ---
// Helper function to interpolate between two hex colors
const interpolateColor = (color1, color2, factor) => {
    const clampedFactor = Math.max(0, Math.min(1, factor));
    const hex = (c) => Math.round(c).toString(16).padStart(2, '0');
    // Ensure colors are valid strings before calling substring
    const safeColor1 = typeof color1 === 'string' && color1.length >= 7 ? color1 : '#FFFFFF';
    const safeColor2 = typeof color2 === 'string' && color2.length >= 7 ? color2 : '#000000';

    const r1 = parseInt(safeColor1.substring(1, 3), 16);
    const g1 = parseInt(safeColor1.substring(3, 5), 16);
    const b1 = parseInt(safeColor1.substring(5, 7), 16);
    const r2 = parseInt(safeColor2.substring(1, 3), 16);
    const g2 = parseInt(safeColor2.substring(3, 5), 16);
    const b2 = parseInt(safeColor2.substring(5, 7), 16);

    const r = r1 + clampedFactor * (r2 - r1);
    const g = g1 + clampedFactor * (g2 - g1);
    const b = b1 + clampedFactor * (b2 - b1);

    return `#${hex(r)}${hex(g)}${hex(b)}`;
};

// =====================================================
// ===> Heatmap Month Fix Applied Here <================
// =====================================================
const ApexHeatmapChart = ({ data, xAxisKeys, yAxisKey, lowColor, highColor, parameter }) => {

    const { series, chartOptions, originalData } = useMemo(() => {
        if (!data || data.length === 0 || !xAxisKeys || xAxisKeys.length === 0) {
            return { series: [], chartOptions: {}, originalData: [] };
        }

        // Dynamically create display categories from xAxisKeys
        const displayCategories = xAxisKeys.map(key => {
            const monthNum = parseInt(key);
            // Check if key is a number between 1 and 12
            if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
                // Format using date-fns: Create a date for that month (year 2000 is arbitrary)
                // Use 'MMM' for month abbreviation (e.g., 'Jan', 'Feb')
                return format(new Date(2000, monthNum - 1, 1), 'MMM'); // monthNum - 1 because Date months are 0-indexed
            }
            // Otherwise, use the key directly (e.g., 'Summer', 'Monsoon')
            return String(key);
        });

        // Store original values matching the order of xAxisKeys for data labels & tooltips
        const originalDataStore = data.map(yearData =>
            xAxisKeys.map(key => yearData[key]) // Use original sorted keys
        );

        const transformedSeries = data.map(yearData => {
            // Row-wise normalization logic (remains the same)
            const rowValues = xAxisKeys.map(key => yearData[key]).filter(v => typeof v === 'number');
            let rowMin, rowMax;
            if (parameter && parameter.toLowerCase().includes('load factor')) {
                rowMin = 0.70;
                rowMax = 1.0;
            } else if (rowValues.length > 0) {
                rowMin = Math.min(...rowValues);
                rowMax = Math.max(...rowValues);
            } else {
                rowMin = 0;
                rowMax = 1;
            }

            return {
                name: yearData[yAxisKey], // Y-axis label (e.g., 'FY2023')
                data: xAxisKeys.map((key, index) => { // Map data using original sorted keys
                    const value = yearData[key] !== undefined ? yearData[key] : 0;
                    // Normalize value for color calculation (remains the same)
                    const normalizedValue = (rowMax - rowMin === 0) ? 50 : ((value - rowMin) / (rowMax - rowMin)) * 100;

                    return {
                        x: displayCategories[index], // Use the dynamically generated category (e.g., 'Jan', 'Feb', 'Summer')
                        y: normalizedValue, // Normalized value determines color
                    };
                })
            };
        }).sort((a, b) => { // Sort rows by year (remains the same)
            const yearA = parseInt(String(a.name).replace(/[^0-9]/g, ''), 10) || 0;
            const yearB = parseInt(String(b.name).replace(/[^0-9]/g, ''), 10) || 0;
            return yearA - yearB;
        });

        // Color scale generation logic (remains the same)
        const colorRanges = [];
        const steps = 10;
        for (let i = 0; i < steps; i++) {
            const factor = i / (steps - 1);
            colorRanges.push({
                from: i * (100 / steps),
                to: (i + 1) * (100 / steps),
                color: interpolateColor(lowColor, highColor, factor),
                name: ''
            });
        }

        const options = {
            chart: { type: 'heatmap', toolbar: { show: false }, background: 'transparent', fontFamily: 'inherit' },
            plotOptions: {
                heatmap: {
                    shadeIntensity: 0.7,
                    radius: 0,
                    useFillColorAsStroke: true,
                    colorScale: { ranges: colorRanges },
                }
            },
            dataLabels: {
                enabled: true,
                style: { fontSize: '12px', colors: ["#fff"], textShadow: '0 0 3px #000' },
                formatter: (val, opts) => {
                    // Use originalDataStore which matches the order of xAxisKeys
                    const originalValue = originalDataStore[opts.seriesIndex]?.[opts.dataPointIndex];
                    if (originalValue === undefined || originalValue === null) return '';
                    // Formatting logic for load factor vs other parameters (remains the same)
                    if (parameter && parameter.toLowerCase().includes('load factor')) {
                        const displayValue = originalValue > 1 ? originalValue : originalValue * 100;
                        return displayValue.toFixed(1) + '%';
                    }
                    return originalValue.toFixed(0);
                },
            },
            stroke: { width: 0 },
            legend: { show: false },
            xaxis: {
                type: 'category',
                categories: displayCategories, // Set categories to the dynamically generated ones
                labels: { style: { colors: '#475569', fontWeight: 'bold' } },
                axisBorder: { show: false },
                axisTicks: { show: false }
            },
            yaxis: {
                labels: { style: { colors: '#475569', fontWeight: 'bold' }, offsetX: -5 }
            },
            tooltip: {
                theme: 'dark',
                y: {
                    formatter: (val, opts) => {
                        // Use originalDataStore which matches the order of xAxisKeys
                        const originalValue = originalDataStore[opts.seriesIndex]?.[opts.dataPointIndex];
                        if (originalValue === undefined || originalValue === null) return val;
                        // Formatting logic for load factor vs other parameters (remains the same)
                        if (parameter && parameter.toLowerCase().includes('load factor')) {
                            const displayValue = originalValue > 1 ? originalValue : originalValue * 100;
                            return displayValue.toFixed(2) + ' %';
                        }
                        return originalValue.toFixed(2);
                    }
                }
            },
            grid: { show: false }
        };

        return { series: transformedSeries, chartOptions: options, originalData: originalDataStore };

    }, [data, xAxisKeys, yAxisKey, lowColor, highColor, parameter]);

    if (!data || data.length === 0) {
        return <div className="text-center text-slate-400 p-4">No data to display.</div>;
    }

    return (
        <div className="chart-container">
            <ReactApexChart options={chartOptions} series={series} type="heatmap" height={data.length * 50 + 60} />
        </div>
    );
};
// =====================================================
// ===> Heatmap Fix Ends Here <=========================
// =====================================================

// --- Color Picker Component ---
const ColorPicker = ({ label, value, onChange }) => (
    <div className="flex items-center gap-2">
        <label className="text-sm font-semibold text-slate-600">{label}</label>
        <input
            type="color"
            value={value}
            onChange={onChange}
            className="w-8 h-8 p-0 border-none rounded cursor-pointer bg-transparent"
        />
    </div>
);

// --- Recharts Tooltip ---
const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        const displayLabel = typeof label === 'number'
            ? `Hour: ${label}:00`
            : format(new Date(label), "MMM d, yyyy, h:mm a");

        return (
            <div className="bg-white/80 backdrop-blur-sm p-3 rounded-lg shadow-lg border border-slate-200/50">
                <p className="font-bold text-slate-800 text-sm mb-1">{displayLabel}</p>
                {payload.map((pld, index) => (
                    <div key={index} style={{ color: pld.color }} className="flex items-center justify-between gap-4 text-sm font-semibold">
                        <span>{`${pld.name}:`}</span>
                        <span>{pld.value.toLocaleString("en-IN", { maximumFractionDigits: 2 })} MW</span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

// --- Recharts Line Chart Wrapper ---
const LineChart = ({ data, title, xKey, yKeys, yAxisLabel, tickStyle, xAxisTickFormatter, xAxisInterval, showBrush = false }) => {
    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-[460px] text-center p-10 bg-slate-50 rounded-2xl border border-slate-200">
                <div>
                    <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V7a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-slate-900">No Data Available</h3>
                    <p className="mt-1 text-sm text-slate-500">There is no data to display for the selected options.</p>
                </div>
            </div>
        );
    }
    return (
        <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-lg border border-slate-200/80">
            <h3 className="text-xl font-bold mb-6 text-slate-800 tracking-tight">{title}</h3>
            <ResponsiveContainer width="100%" height={300}>
                <RechartsLineChart data={data} margin={{ top: 5, right: 30, left: 50, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis
                        dataKey={xKey}
                        stroke="#94a3b8"
                        tick={{ ...tickStyle, fontSize: 12 }}
                        tickLine={false}
                        axisLine={{ stroke: '#e2e8f0' }}
                        dy={10}
                        tickFormatter={xAxisTickFormatter}
                        interval={xAxisInterval}
                    />
                    <YAxis
                        stroke="#94a3b8"
                        tick={{ ...tickStyle, fontSize: 12 }}
                        tickFormatter={(value) => typeof value === 'number' ? value.toLocaleString("en-IN") : value}
                        allowDecimals={false}
                        domain={['auto', 'auto']}
                        tickLine={false}
                        axisLine={false}
                        label={{ value: yAxisLabel?.value, angle: -90, position: 'insideLeft', offset: -35, style: { fill: '#334155' } }}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '3 3' }} />
                    {yKeys.map((key, index) => (
                        <Line
                            key={key}
                            type="monotone"
                            dataKey={key}
                            stroke={['#3B82F6', '#F97316', '#10B981'][index % 3]}
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 6, strokeWidth: 2, fill: '#fff' }}
                            name={key.replace(/_/g, ' ')}
                        />
                    ))}
                    {showBrush && <Brush dataKey={xKey} height={30} stroke="#8884d8" tickFormatter={(tick) => format(new Date(tick), 'MMM d')} />}
                </RechartsLineChart>
            </ResponsiveContainer>
        </div>
    );
};


const OverviewDashboard = ({ profileName, profileState, updateProfileState, projectPath }) => { 

    const [monthlyData, setMonthlyData] = useState(null);
    const [seasonalData, setSeasonalData] = useState(null);
    const [monthlyColumns, setMonthlyColumns] = useState([]);
    const [seasonalColumns, setSeasonalColumns] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');


    const {
        overviewMonthlyParam,
        overviewSeasonalParam,
        overviewMonthlyLowColor,
        overviewMonthlyHighColor,
        overviewSeasonalLowColor,
        overviewSeasonalHighColor
    } = profileState;

    useEffect(() => {

        if (!profileName) {
            setError('No profile name provided.');
            setIsLoading(false);
            return;
        }
        if (!projectPath) { 
            setError('No active project path provided.');
            setIsLoading(false);
            return;
        }

        const fetchAnalysisData = async () => {
            setIsLoading(true);
            setError('');
            try {

                const [monthlyRes, seasonalRes] = await Promise.all([
                    axios.get(`/project/analysis-data?projectPath=${encodeURIComponent(projectPath)}&profileName=${profileName}&sheetName=Monthly_analysis`),
                    axios.get(`/project/analysis-data?projectPath=${encodeURIComponent(projectPath)}&profileName=${profileName}&sheetName=Season_analysis`)
                ]);

                if (monthlyRes.data.success) {
                    setMonthlyData(monthlyRes.data.data || {});
                    setMonthlyColumns(monthlyRes.data.columns || []);
                } else {
                    throw new Error(monthlyRes.data.message || 'Failed to fetch monthly data.');
                }
                if (seasonalRes.data.success) {
                    setSeasonalData(seasonalRes.data.data || {});
                    setSeasonalColumns(seasonalRes.data.columns || []);
                } else {
                    throw new Error(seasonalRes.data.message || 'Failed to fetch seasonal data.');
                }
            } catch (err) {
                setError(err.message || 'Failed to fetch analysis data.');
            } finally {
                setIsLoading(false);
            }
        };
        fetchAnalysisData();
    }, [profileName, projectPath]); 

    const monthlyParameters = monthlyData ? Object.keys(monthlyData).filter(key => monthlyData[key] && monthlyData[key].length > 0) : [];
    const seasonalParameters = seasonalData ? Object.keys(seasonalData).filter(key => seasonalData[key] && seasonalData[key].length > 0) : [];

    useEffect(() => {
        if (monthlyParameters.length > 0 && !monthlyParameters.includes(overviewMonthlyParam)) {
            updateProfileState({ overviewMonthlyParam: monthlyParameters[0] });
        }
    }, [monthlyParameters, overviewMonthlyParam, updateProfileState]);

    useEffect(() => {
        if (seasonalParameters.length > 0 && !seasonalParameters.includes(overviewSeasonalParam)) {
            updateProfileState({ overviewSeasonalParam: seasonalParameters[0] });
        }
    }, [seasonalParameters, overviewSeasonalParam, updateProfileState]);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-full gap-2 text-slate-500">
                <Loader2 className="animate-spin" />
                Loading Overview Data...
            </div>
        );
    }
    if (error) {
        return (
            <div className="flex justify-center items-center h-full gap-2 text-red-600">
                <AlertTriangle />
                {error}
            </div>
        );
    }

    const currentMonthlyData = monthlyData && monthlyData[overviewMonthlyParam];
    const currentSeasonalData = seasonalData && seasonalData[overviewSeasonalParam];

    return (
        <div className="space-y-8">
            <section>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-slate-800">Monthly Analysis</h2>
                    <div className="flex items-center gap-4">
                        <ColorPicker label="Low" value={overviewMonthlyLowColor} onChange={e => updateProfileState({ overviewMonthlyLowColor: e.target.value })} />
                        <ColorPicker label="High" value={overviewMonthlyHighColor} onChange={e => updateProfileState({ overviewMonthlyHighColor: e.target.value })} />
                        <div className="h-6 w-px bg-slate-300"></div>
                        <label htmlFor="monthly-param" className="text-sm font-semibold text-slate-600">Parameter</label>
                        <select
                            id="monthly-param"
                            value={overviewMonthlyParam}
                            onChange={e => updateProfileState({ overviewMonthlyParam: e.target.value })}
                            className="bg-white border-2 border-slate-300 rounded-lg px-2.5 py-1.5 text-sm font-semibold"
                            disabled={monthlyParameters.length === 0}
                        >
                            {monthlyParameters.length > 0 ? (
                                monthlyParameters.map(p => <option key={p} value={p}>{p}</option>)
                            ) : (
                                <option value="">No parameters available</option>
                            )}
                        </select>
                    </div>
                </div>
                {currentMonthlyData && currentMonthlyData.length > 0 ? (
                    <ApexHeatmapChart
                        key={overviewMonthlyParam + '-monthly' + overviewMonthlyLowColor + overviewMonthlyHighColor}
                        data={currentMonthlyData}
                        yAxisKey="Fiscal_Year"
                        xAxisKeys={monthlyColumns}
                        lowColor={overviewMonthlyLowColor}
                        highColor={overviewMonthlyHighColor}
                        parameter={overviewMonthlyParam}
                    />
                ) : (
                    <div className="h-[350px] flex items-center justify-center bg-slate-50 rounded-lg text-slate-500">
                        No data available for this parameter.
                    </div>
                )}
            </section>
            <section>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-slate-800">Seasonal Analysis</h2>
                    <div className="flex items-center gap-4">
                        <ColorPicker label="Low" value={overviewSeasonalLowColor} onChange={e => updateProfileState({ overviewSeasonalLowColor: e.target.value })} />
                        <ColorPicker label="High" value={overviewSeasonalHighColor} onChange={e => updateProfileState({ overviewSeasonalHighColor: e.target.value })} />
                        <div className="h-6 w-px bg-slate-300"></div>
                        <label htmlFor="seasonal-param" className="text-sm font-semibold text-slate-600">Parameter</label>
                        <select
                            id="seasonal-param"
                            value={overviewSeasonalParam}
                            onChange={e => updateProfileState({ overviewSeasonalParam: e.target.value })}
                            className="bg-white border-2 border-slate-300 rounded-lg px-2.5 py-1.5 text-sm font-semibold"
                            disabled={seasonalParameters.length === 0}
                        >
                            {seasonalParameters.length > 0 ? (
                                seasonalParameters.map(p => <option key={p} value={p}>{p}</option>)
                            ) : (
                                <option value="">No parameters available</option>
                            )}
                        </select>
                    </div>
                </div>
                {currentSeasonalData && currentSeasonalData.length > 0 ? (
                    <ApexHeatmapChart
                        key={overviewSeasonalParam + '-seasonal' + overviewSeasonalLowColor + overviewSeasonalHighColor}
                        data={currentSeasonalData}
                        yAxisKey="Fiscal_Year"
                        xAxisKeys={seasonalColumns}
                        lowColor={overviewSeasonalLowColor}
                        highColor={overviewSeasonalHighColor}
                        parameter={overviewSeasonalParam}
                    />
                ) : (
                    <div className="h-[350px] flex items-center justify-center bg-slate-50 rounded-lg text-slate-500">
                        No data available for this parameter.
                    </div>
                )}
            </section>
        </div>
    );
};

// =================================================================================
// == MAIN COMPONENT ===============================================================
// =================================================================================

const AnalyzeProfiles = ({ activeProject }) => {

    // --- Active Project Check ---
    if (!activeProject || !activeProject.path) {
        return (
            <div className="h-full w-full flex items-center justify-center p-4">
                <div className="text-center p-10 bg-white rounded-xl border border-slate-200 shadow-sm">
                    <AlertTriangle className="mx-auto h-12 w-12 text-slate-400 mb-4" />
                    <h3 className="text-lg font-semibold text-slate-900">No Project Loaded</h3>
                    <p className="mt-1 text-sm text-slate-500">Please create or load a project first to analyze load profiles.</p>
                </div>
            </div>
        );
    }

    // --- Global State Access ---
    const store = useAnalyzeProfilesStore();
    const {
        availableProfiles,
        selectedProfile,
        isLoadingProfiles,
        errorProfiles,
        profilesState,
        updateCurrentProfileState,
        setSelectedProfile: selectProfileInStore,
        fetchProfiles
    } = store;

    // Get state for the *currently selected profile*, with fallbacks.
    const currentProfileState = useMemo(() =>
        profilesState[selectedProfile] || getDefaultProfileState(),
        [profilesState, selectedProfile]
    );

    const {
        selectedYear,
        availableYears,
        activeTab,
        dateRange,
        selectedMonth,
        selectedSeason,
    } = currentProfileState;

    // --- Data Fetching Effects ---
    useEffect(() => {
        if (activeProject?.path) {
            fetchProfiles(activeProject.path);
        }
    }, [fetchProfiles, activeProject]);

    // --- Event Handlers ---
    const handleProfileChange = (e) => {
        const newProfileName = e.target.value;
        if (activeProject?.path) {
            selectProfileInStore(newProfileName, activeProject.path);
        } else {
            console.error("Cannot change profile, active project path is missing.");
        }
    };

    const handlePeriodChange = (e) => {
        updateCurrentProfileState({ selectedYear: e.target.value });
    };

    const handleTabChange = (tabName) => {
        updateCurrentProfileState({ activeTab: tabName });
    };

    // --- Chart Data Processing (Time Series) ---
    const [fullYearData, setFullYearData] = useState([]);
    const [isLoadingTimeSeries, setIsLoadingTimeSeries] = useState(false);
    const [errorTimeSeries, setErrorTimeSeries] = useState('');

    useEffect(() => {
        const fetchYearData = async () => {
            if (!selectedProfile || !selectedYear || selectedYear === 'Overall') {
                setFullYearData([]);
                setIsLoadingTimeSeries(false);
                setErrorTimeSeries('');
                return;
            }
            setIsLoadingTimeSeries(true);
            setErrorTimeSeries('');
            try {
                if (!activeProject || !activeProject.path) {
                    throw new Error("No active project found.");
                }
                const params = {
                    projectPath: activeProject.path,
                    profileName: selectedProfile,
                    fiscalYear: selectedYear,
                };
                const response = await axios.get('/project/full-load-profile', { params });
                if (response.data.success) {
                    const formattedData = response.data.data.map(d => ({
                        ...d,
                        DateTime: new Date(d.DateTime),
                        Hour: new Date(d.DateTime).getHours(),
                        Date: new Date(d.DateTime).getDate(),
                        Month: new Date(d.DateTime).getMonth() + 1
                    }));
                    setFullYearData(formattedData);

                    const currentRange = currentProfileState.dateRange;
                    if (!currentRange) {
                        const year = parseInt(selectedYear.replace('FY', '')) - 1;
                        const defaultFrom = new Date(year, 3, 1);
                        const defaultTo = new Date(year, 3, 7);
                        updateCurrentProfileState({ dateRange: { from: defaultFrom.toISOString(), to: defaultTo.toISOString() } });
                    }
                } else {
                    throw new Error(response.data.message || 'Failed to fetch time series data.');
                }
            } catch (err) {
                setErrorTimeSeries(err.message || 'Failed to fetch time series data.');
                setFullYearData([]);
            } finally {
                setIsLoadingTimeSeries(false);
            }
        };
        fetchYearData();
    }, [selectedYear, selectedProfile, updateCurrentProfileState, activeProject]);


    // --- Memoized Chart Data Calculations ---
    const safeDateRange = useMemo(() => {
        if (!dateRange) return undefined;
        return {
            from: dateRange.from ? new Date(dateRange.from) : undefined,
            to: dateRange.to ? new Date(dateRange.to) : undefined,
        };
    }, [dateRange]);

    const yearWiseChartData = useMemo(() => {
        if (!safeDateRange?.from || !fullYearData.length) return [];
        const startDate = startOfDay(safeDateRange.from);
        const endDate = endOfDay(safeDateRange.to || safeDateRange.from);
        return fullYearData.filter(d =>
            d.DateTime.getTime() >= startDate.getTime() &&
            d.DateTime.getTime() <= endDate.getTime()
        );
    }, [fullYearData, safeDateRange]);

    const monthWiseChartData = useMemo(() => {
        return fullYearData.filter(d => d.Month === selectedMonth);
    }, [fullYearData, selectedMonth]);

    const seasonWiseChartData = useMemo(() => {
        const seasonMonths = {
            'Monsoon': [7, 8, 9],
            'Post-monsoon': [10, 11],
            'Winter': [12, 1, 2],
            'Summer': [3, 4, 5, 6]
        };
        return fullYearData.filter(d => seasonMonths[selectedSeason].includes(d.Month));
    }, [fullYearData, selectedSeason]);

    const dayTypeChartData = useMemo(() => {
        if (!fullYearData.length) return [];
        const hourlyAverages = {};
        for (let h = 0; h < 24; h++) {
            hourlyAverages[h] = { Holiday: 0, Weekday: 0, Weekend: 0, countHoliday: 0, countWeekday: 0, countWeekend: 0 };
        }
        fullYearData.forEach(d => {
            const hour = d.Hour;
            if (hourlyAverages[hour] !== undefined) {
                let dayType = 'Weekday';
                if (d.is_holiday === 1) dayType = 'Holiday';
                else if (d.is_weekend === 1) dayType = 'Weekend';
                const demand = d.Demand_MW || 0;
                if (dayType === 'Holiday') {
                    hourlyAverages[hour].Holiday += demand;
                    hourlyAverages[hour].countHoliday += 1;
                } else if (dayType === 'Weekday') {
                    hourlyAverages[hour].Weekday += demand;
                    hourlyAverages[hour].countWeekday += 1;
                } else if (dayType === 'Weekend') {
                    hourlyAverages[hour].Weekend += demand;
                    hourlyAverages[hour].countWeekend += 1;
                }
            }
        });
        const result = Object.keys(hourlyAverages).map(hour => ({
            Hour: parseInt(hour),
            Holiday: hourlyAverages[hour].countHoliday > 0 ? hourlyAverages[hour].Holiday / hourlyAverages[hour].countHoliday : 0,
            Weekday: hourlyAverages[hour].countWeekday > 0 ? hourlyAverages[hour].Weekday / hourlyAverages[hour].countWeekday : 0,
            Weekend: hourlyAverages[hour].countWeekend > 0 ? hourlyAverages[hour].Weekend / hourlyAverages[hour].countWeekend : 0
        })).sort((a, b) => a.Hour - b.Hour);
        return result;
    }, [fullYearData]);

    const maxMinAvgChartData = useMemo(() => {
        if (!fullYearData.length) return { series: [], options: {}, maxDemandDate: '', minDemandDate: '' };

        let dataToProcess = fullYearData;
        let periodName = selectedYear;
        if (activeTab === 'Month-wise') {
            dataToProcess = monthWiseChartData;
            periodName = `${format(new Date(2000, selectedMonth - 1, 1), 'MMMM')} ${selectedYear}`;
        } else if (activeTab === 'Season-wise') {
            dataToProcess = seasonWiseChartData;
            periodName = `${selectedSeason} ${selectedYear}`;
        }

        if (!dataToProcess.length) return { series: [], options: {}, maxDemandDate: '', minDemandDate: '' };

        const maxDemandValue = Math.max(...dataToProcess.map(d => d.Demand_MW));
        const maxDemandRecord = dataToProcess.find(d => d.Demand_MW === maxDemandValue);
        const maxDemandDate = maxDemandRecord ? format(maxDemandRecord.DateTime, 'dd-MM-yyyy') : '';
        const maxData = maxDemandRecord ? dataToProcess
            .filter(d => format(d.DateTime, 'dd-MM-yyyy') === maxDemandDate)
            .sort((a, b) => a.Hour - b.Hour)
            .map(d => d.Demand_MW || 0) : [];

        const minDemandValue = Math.min(...dataToProcess.map(d => d.Demand_MW));
        const minDemandRecord = dataToProcess.find(d => d.Demand_MW === minDemandValue);
        const minDemandDate = minDemandRecord ? format(minDemandRecord.DateTime, 'dd-MM-yyyy') : '';
        const minData = minDemandRecord ? dataToProcess
            .filter(d => format(d.DateTime, 'dd-MM-yyyy') === minDemandDate)
            .sort((a, b) => a.Hour - b.Hour)
            .map(d => d.Demand_MW || 0) : [];

        const hourlyAverages = {};
        for (let h = 0; h < 24; h++) {
            hourlyAverages[h] = { total: 0, count: 0 };
        }
        dataToProcess.forEach(d => {
            const hour = d.Hour;
            if (hourlyAverages[hour]) {
                hourlyAverages[hour].total += d.Demand_MW || 0;
                hourlyAverages[hour].count += 1;
            }
        });
        const avgData = Array.from({ length: 24 }, (_, hour) =>
            hourlyAverages[hour] && hourlyAverages[hour].count > 0
                ? hourlyAverages[hour].total / hourlyAverages[hour].count
                : 0
        );

        const series = [
            { name: `Maximum Demand`, data: maxData },
            { name: `Minimum Demand`, data: minData },
            { name: 'Average Demand', data: avgData }
        ];

        const titleText = `Max, Min, and Average Hourly Demand for ${periodName}`;

        const options = {
            chart: { height: 280, type: 'line', toolbar: { show: true }, parentHeightOffset: 0, background: 'transparent' },
            colors: ['#10B981', '#F97316', '#3B82F6'],
            stroke: { width: 2, curve: 'smooth' },
            xaxis: { categories: Array.from({ length: 24 }, (_, i) => `${i}:00`), title: { text: 'Hour', style: { fontSize: '14px', fontWeight: 'bold', color: '#000000' } }, labels: { style: { fontSize: '12px', fontWeight: 'bold', colors: ['#000000'] } }, axisBorder: { show: false }, axisTicks: { show: false } },
            yaxis: { title: { text: 'Demand (MW)', style: { fontSize: '14px', fontWeight: 'bold', color: '#000000' } }, labels: { style: { fontSize: '12px', fontWeight: 'bold', colors: ['#000000'] }, formatter: (val) => (typeof val === 'number' ? val.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : val) } },
            legend: { position: 'top', fontSize: '10px', itemMargin: { horizontal: 8 }, markers: { width: 8, height: 8, radius: 10 } },
            title: { text: titleText, align: 'left', style: { fontSize: '14px', fontWeight: 'bold', color: '#334155' } },
            grid: { borderColor: '#e2e8f0', strokeDashArray: 3, padding: { left: 5, right: 10 } }
        };

        return { series, options, maxDemandDate, minDemandDate };
    }, [fullYearData, selectedYear, activeTab, monthWiseChartData, seasonWiseChartData, selectedMonth, selectedSeason]);

    const dayTypeChartConfig = useMemo(() => {
        if (!dayTypeChartData.length || dayTypeChartData.every(d => d.Holiday === 0 && d.Weekday === 0 && d.Weekend === 0)) return null;
        const options = {
            chart: { height: 280, type: 'line', toolbar: { show: true }, parentHeightOffset: 0, background: 'transparent' },
            colors: ['#10B981', '#F97316', '#3B82F6'],
            stroke: { width: 2, curve: 'smooth' },
            xaxis: { categories: dayTypeChartData.map(d => d.Hour), title: { text: 'Hour', style: { fontSize: '14px', fontWeight: 'bold', color: '#000000' } }, labels: { style: { fontSize: '12px', fontWeight: 'bold', colors: ['#000000'] } }, axisBorder: { show: false }, axisTicks: { show: false } },
            yaxis: { title: { text: 'Average Demand (MW)', style: { fontSize: '14px', fontWeight: 'bold', color: '#000000' } }, labels: { style: { fontSize: '12px', fontWeight: 'bold', colors: ['#000000'] }, formatter: (val) => (typeof val === 'number' ? val.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : val) } },
            tooltip: { theme: 'light', y: { formatter: (val) => val != null ? val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'N/A' } },
            legend: { position: 'top', fontSize: '10px', itemMargin: { horizontal: 8 }, markers: { width: 8, height: 8, radius: 10 } },
            title: { text: 'Average Hourly Demand by Day Type', align: 'left', style: { fontSize: '14px', fontWeight: 'bold', color: '#334155' } },
            grid: { borderColor: '#e2e8f0', strokeDashArray: 3, padding: { left: 5, right: 10 } }
        };
        const series = [
            { name: 'Holiday', data: dayTypeChartData.map(d => d.Holiday) },
            { name: 'Weekday', data: dayTypeChartData.map(d => d.Weekday) },
            { name: 'Weekend', data: dayTypeChartData.map(d => d.Weekend) }
        ];
        return { options, series };
    }, [dayTypeChartData]);


    // --- Render Logic ---
    const analysisTabs = [
        { name: 'Overview', icon: <LayoutDashboard size={16} /> },
        { name: 'Time Series Analysis', icon: <Calendar size={16} /> },
        { name: 'Month-wise', icon: <CalendarDays size={16} /> },
        { name: 'Season-wise', icon: <Sun size={16} /> },
        { name: 'Day-type', icon: <Moon size={16} /> },
        { name: 'Load Duration', icon: <AreaChart size={16} /> },
    ];

    const renderTabContent = () => {
        if (!selectedProfile && !isLoadingProfiles) {
            return (
                <div className="text-center text-slate-500 pt-10">
                    <h3 className="text-lg font-semibold">No Load Profiles Found</h3>
                    <p className="mt-2 text-sm">Please generate a load profile first to begin analysis.</p>
                </div>
            );
        }

        const commonTimeSeriesCheck = () => {
            if (selectedYear === 'Overall') {
                return (
                    <div className="mt-2 p-8 bg-slate-50 rounded-lg flex items-center justify-center h-[460px]">
                        <p className="text-indigo-600 font-semibold">Please select a specific Fiscal Year from the "Period" dropdown above to view time series analysis.</p>
                    </div>
                );
            }
            if (isLoadingTimeSeries) {
                return (
                    <div className="flex items-center justify-center h-[460px]">
                        <Loader2 className="animate-spin text-indigo-500" size={32} />
                        Loading time series data...
                    </div>
                );
            }
            if (errorTimeSeries) {
                return (
                    <div className="flex items-center justify-center h-[460px] text-red-600">
                        <AlertTriangle />
                        {errorTimeSeries}
                    </div>
                );
            }
            return null;
        };

        const fiscalYearNumber = selectedYear && selectedYear.startsWith('FY')
            ? parseInt(selectedYear.replace('FY', ''))
            : new Date().getFullYear();
        const calStartMonth = new Date(fiscalYearNumber - 1, 3, 1);
        const calEndMonth = new Date(fiscalYearNumber, 2, 31);
        const dynamicTickFormatter = (tick) => format(new Date(tick), 'MMM d, h:mm a');

        const { series: apexSeries, options: apexOptions, maxDemandDate, minDemandDate } = maxMinAvgChartData;
        const apexCustomTooltip = {
            custom: function({ series, seriesIndex, dataPointIndex, w }) {
                let html = `<div class="rounded-lg shadow-lg bg-white p-3 border border-slate-200 text-left">
                            <p class="font-bold text-slate-800 text-sm mb-1">Hour: ${dataPointIndex}:00</p>`;
                series.forEach((s, i) => {
                    let dateInfo = '';
                    if (w.globals.seriesNames[i] === 'Maximum Demand') dateInfo = `(on ${maxDemandDate})`;
                    else if (w.globals.seriesNames[i] === 'Minimum Demand') dateInfo = `(on ${minDemandDate})`;
                    const value = w.globals.initialSeries[i].data[dataPointIndex];
                    if (value !== null && value !== undefined) {
                        html += `<div class="flex items-center justify-between gap-4 text-sm font-semibold">
                                <span style="color: ${w.globals.colors[i]}">${w.globals.seriesNames[i]} ${dateInfo}:</span>
                                <span class="ml-2">${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MW</span>
                            </div>`;
                    }
                });
                html += `</div>`;
                return html;
            }
        };
        const updatedApexOptions = { ...apexOptions, tooltip: apexCustomTooltip };

        switch (activeTab) {
            case 'Overview':
                return <OverviewDashboard
                    profileName={selectedProfile}
                    profileState={currentProfileState}
                    updateProfileState={updateCurrentProfileState}
                    projectPath={activeProject?.path} // <-- MODIFICATION: Pass project path prop
                />;

            case 'Time Series Analysis': {
                const timeSeriesStatus = commonTimeSeriesCheck();
                if (timeSeriesStatus) return timeSeriesStatus;

                return (
                    <div className="p-2 space-y-4">
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="flex-shrink-0 bg-white p-2 rounded-xl shadow-lg border border-slate-200/80 self-start">
                                <DayPicker
                                    mode="range"
                                    selected={safeDateRange}
                                    onSelect={(range) => updateCurrentProfileState({ dateRange: range ? { from: range.from?.toISOString(), to: range.to?.toISOString() } : undefined })}
                                    fromMonth={calStartMonth}
                                    toMonth={calEndMonth}
                                    defaultMonth={calStartMonth}
                                    captionLayout="dropdown-buttons"
                                    fromYear={fiscalYearNumber - 1}
                                    toYear={fiscalYearNumber}
                                    className="text-sm"
                                    modifiersClassNames={{ day: 'p-1', caption: 'text-sm', caption_dropdowns: 'text-sm', button: 'text-sm p-1' }}
                                />
                            </div>
                            <div className="flex-grow">
                                <LineChart
                                    data={yearWiseChartData}
                                    title={`Hourly Demand for Selected Range`}
                                    xKey="DateTime"
                                    yKeys={['Demand_MW']}
                                    yAxisLabel={{ value: 'Demand (MW)', style: { fill: '#334155' } }}
                                    tickStyle={{ fill: '#64748b' }}
                                    xAxisTickFormatter={dynamicTickFormatter}
                                    showBrush={true}
                                    xAxisInterval="preserveStartEnd"
                                />
                            </div>
                        </div>
                        <div className="bg-slate-50/50 rounded-lg border border-slate-200 p-1">
                            {apexSeries.length > 0 ? (
                                <ReactApexChart options={updatedApexOptions} series={apexSeries} type="line" height={280} />
                            ) : (<div className="text-center p-2 text-slate-500 text-xs">No chart data.</div>)}
                        </div>
                    </div>
                );
            }

            case 'Month-wise': {
                const monthWiseStatus = commonTimeSeriesCheck();
                if (monthWiseStatus) return monthWiseStatus;

                return (
                    <div className="p-2 space-y-4">
                        <div className="mb-4 max-w-xs">
                            <label htmlFor="month-select" className="block text-sm font-semibold text-slate-600 mb-1">Select Month</label>
                            <select
                                id="month-select"
                                value={selectedMonth}
                                onChange={(e) => updateCurrentProfileState({ selectedMonth: Number(e.target.value) })}
                                className="w-full bg-white border-2 border-slate-300 rounded-lg px-2.5 py-1.5 text-sm font-semibold"
                            >
                                <option value={4}>April</option> <option value={5}>May</option> <option value={6}>June</option>
                                <option value={7}>July</option> <option value={8}>August</option> <option value={9}>September</option>
                                <option value={10}>October</option> <option value={11}>November</option> <option value={12}>December</option>
                                <option value={1}>January</option> <option value={2}>February</option> <option value={3}>March</option>
                            </select>
                        </div>
                        <LineChart
                            data={monthWiseChartData}
                            title={`Hourly Demand for ${format(new Date(2000, selectedMonth - 1, 1), 'MMMM')}`}
                            xKey="DateTime"
                            yKeys={['Demand_MW']}
                            yAxisLabel={{ value: 'Demand (MW)', style: { fill: '#334155' } }}
                            tickStyle={{ fill: '#64748b' }}
                            xAxisTickFormatter={dynamicTickFormatter}
                            xAxisInterval="preserveStartEnd"
                            showBrush={true}
                        />
                        <div className="bg-slate-50/50 rounded-lg border border-slate-200 p-1">
                            {apexSeries.length > 0 ? (
                                <ReactApexChart options={updatedApexOptions} series={apexSeries} type="line" height={280} />
                            ) : (<div className="text-center p-2 text-slate-500 text-xs">No chart data for this month.</div>)}
                        </div>
                    </div>
                );
            }

            case 'Season-wise': {
                const seasonWiseStatus = commonTimeSeriesCheck();
                if (seasonWiseStatus) return seasonWiseStatus;

                return (
                    <div className="p-2 space-y-4">
                        <div className="mb-4 max-w-xs">
                            <label htmlFor="season-select" className="block text-sm font-semibold text-slate-600 mb-1">Select Season</label>
                            <select
                                id="season-select"
                                value={selectedSeason}
                                onChange={(e) => updateCurrentProfileState({ selectedSeason: e.target.value })}
                                className="w-full bg-white border-2 border-slate-300 rounded-lg px-2.5 py-1.5 text-sm font-semibold"
                            >
                                <option value="Monsoon">Monsoon</option>
                                <option value="Post-monsoon">Post-monsoon</option>
                                <option value="Winter">Winter</option>
                                <option value="Summer">Summer</option>
                            </select>
                        </div>
                        <LineChart
                            data={seasonWiseChartData}
                            title={`Hourly Demand for ${selectedSeason}`}
                            xKey="DateTime"
                            yKeys={['Demand_MW']}
                            yAxisLabel={{ value: 'Demand (MW)', style: { fill: '#334155' } }}
                            tickStyle={{ fill: '#64748b' }}
                            xAxisTickFormatter={dynamicTickFormatter}
                            xAxisInterval="preserveStartEnd"
                            showBrush={true}
                        />
                        <div className="bg-slate-50/50 rounded-lg border border-slate-200 p-1">
                            {apexSeries.length > 0 ? (
                                <ReactApexChart options={updatedApexOptions} series={apexSeries} type="line" height={280} />
                            ) : (<div className="text-center p-2 text-slate-500 text-xs">No chart data for this season.</div>)}
                        </div>
                    </div>
                );
            }

            case 'Day-type': {
                const dayTypeStatus = commonTimeSeriesCheck();
                if (dayTypeStatus) return dayTypeStatus;

                return (
                    <div className="p-2">
                        <div className="bg-slate-50/50 rounded-lg border border-slate-200 p-1">
                            {dayTypeChartConfig ? (
                                <ReactApexChart options={dayTypeChartConfig.options} series={dayTypeChartConfig.series} type="line" height={280} />
                            ) : (
                                <div className="text-center p-2 text-slate-500 text-xs">No chart data or all averages are zero.</div>
                            )}
                        </div>
                    </div>
                );
            }

            default:
                return <div className="text-center text-slate-500">Content for {activeTab}</div>;
        }
    };

    return (
        <div className="h-full w-full bg-slate-50 text-slate-800 p-2 font-sans flex flex-col gap-2">
            {/* Top Control Bar */}
            <div className="flex-shrink-0 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <label htmlFor="load-profile-file" className="text-sm font-semibold text-slate-600">Load Profile File</label>
                            <select
                                id="load-profile-file"
                                value={selectedProfile}
                                onChange={handleProfileChange}
                                disabled={isLoadingProfiles || availableProfiles.length === 0}
                                className="bg-white border-2 border-slate-300 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition w-60 disabled:bg-slate-100 disabled:cursor-not-allowed"
                            >
                                {isLoadingProfiles ? (
                                    <option>Loading profiles...</option>
                                ) : errorProfiles ? (
                                    <option>Error loading profiles</option>
                                ) : availableProfiles.length > 0 ? (
                                    availableProfiles.map(p => <option key={p} value={p}>{p}</option>)
                                ) : (
                                    <option>No profiles found</option>
                                )}
                            </select>
                        </div>
                        <div className="flex items-center gap-2">
                            <label htmlFor="period-select" className="text-sm font-semibold text-slate-600">Period</label>
                            <select
                                id="period-select"
                                value={selectedYear || 'Overall'}
                                onChange={handlePeriodChange}
                                className="bg-white border-2 border-slate-300 rounded-lg px-2.5 py-1.5 text-sm font-semibold"
                            >
                                {availableYears.map(period => (
                                    <option key={period} value={period}>{period}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            </div>
            {/* Tab Navigation and Content Area */}
            <div className="flex-grow bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                <div className="flex-shrink-0 border-b border-slate-200">
                    <div className="w-full overflow-x-auto">
                        <div className="flex gap-1 p-1.5 w-max">
                            {analysisTabs.map((tab) => (
                                <button
                                    key={tab.name}
                                    onClick={() => handleTabChange(tab.name)}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all text-sm ${activeTab === tab.name ? 'bg-indigo-100 text-indigo-700 shadow-sm' : 'bg-transparent text-slate-600 hover:bg-slate-100'}`}
                                >
                                    {tab.icon}
                                    {tab.name}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="flex-grow p-4 overflow-y-auto">
                    {isLoadingProfiles ? (
                        <div className="flex justify-center items-center h-full gap-2 text-slate-500">
                            <Loader2 className="animate-spin" />
                            Loading Profile Data...
                        </div>
                    ) : errorProfiles && !selectedProfile ? (
                        <div className="text-center text-red-600 pt-10">
                            <AlertTriangle className="mx-auto h-8 w-8 mb-2" />
                            {errorProfiles}
                        </div>
                    ) : (
                        renderTabContent()
                    )}
                </div>
            </div>
        </div>
    );
};

export default AnalyzeProfiles;