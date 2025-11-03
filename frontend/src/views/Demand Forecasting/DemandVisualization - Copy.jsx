

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import axios from 'axios';
import ReactECharts from 'echarts-for-react';
import toast, { Toaster } from 'react-hot-toast';
import {
    Cpu, XCircle, Download, Save, Scale, Table,
    AreaChart as AreaIcon, BarChart3, Loader2, CheckCircle
} from 'lucide-react';

// Component Imports
import TDLossesTab from './TDLossesTab';
import CompareScenarioModal from './CompareScenarioModal';
import AreaChartComponent from '../../components/charts/AreaChartComponent';
import StackedBarChartComponent from '../../components/charts/StackedBarChartComponent';
import ModelSelection from './ModelSelection';

import { useSettingsStore } from '../../store/settingsStore';

const ScenarioDataView = ({ scenarioName, activeSectorName, tableData, isLoading, error, unit, formatCellData, convertValue, colorConfig, hiddenSeries, onLegendClick, zoomRange, onZoomChange }) => {


    const lineChartOptions = useMemo(() => {
        if (!tableData || tableData.length === 0) return null;

        const allKeys = Object.keys(tableData[0]);
        const modelKeys = allKeys.filter(key => ['MLR', 'SLR', 'WAM', 'Historical', 'User Data', 'Time Series'].includes(key));
        if (modelKeys.length === 0) return null;

        const colors = colorConfig?.models ? modelKeys.map(key => colorConfig.models[key] || '#3b82f6') : ['#10B981', '#F97316', '#3B82F6', '#6B7280', '#EF4444', '#8B5CF6'];

        const series = modelKeys.map((key, index) => ({
            name: key,
            type: 'line',
            smooth: true,
            showSymbol: false,
            emphasis: {
                focus: 'series'
            },
            data: tableData.map(row => (row && row[key] != null) ? convertValue(parseFloat(row[key]), unit) : null),
            itemStyle: {
                color: colors[index % colors.length]
            }
        }));

        const axisLabelStyle = { fontSize: '14px', fontWeight: 'bold', color: '#000000' };
        const tickStyle = { fontSize: '12px', fontWeight: 'bold', color: '#000000' };

        return {
            title: {
                text: `Forecast: ${activeSectorName}`,
                left: 'center',
                textStyle: {
                    fontSize: '14px',
                    fontWeight: 'bold',
                    color: '#334155'
                }
            },
            tooltip: {
                trigger: 'axis',
                formatter: (params) => {
                    const year = params[0].name;
                    let listItems = params.map(item => {
                        const value = item.value;
                        if (value === undefined || value === null) return '';
                        return `<li style="display: flex; align-items: center; padding: 4px 0;">
                                    <span style="background-color: ${item.color}; width: 12px; height: 12px; border-radius: 50%; margin-right: 8px; flex-shrink: 0;"></span>
                                    <span style="font-family: sans-serif; font-size: 14px; color: #555; white-space: nowrap; flex-grow: 1;">${item.seriesName}:</span>
                                    <span style="font-family: sans-serif; font-size: 14px; color: #222; font-weight: 600; margin-left: 12px;">${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${unit}</span>
                                </li>`;
                    }).join('');

                    return `<div style="padding: 1rem; background-color: rgba(255, 255, 255, 0.9); border: 1px solid #d1d5db; border-radius: 0.5rem;">
                                <p style="font-weight: 700; color: #1e293b; margin-bottom: 0.5rem;">Year: ${year}</p>
                                <ul style="list-style: none; padding: 0; margin: 0;">${listItems}</ul>
                            </div>`;
                }
            },
            legend: {
                top: '12%',
                type: 'scroll',
                selected: modelKeys.reduce((acc, key) => {
                    acc[key] = !(hiddenSeries || []).includes(key);
                    return acc;
                }, {})
            },
            // ✅ FIX 1: Use a large percentage-based left margin and disable containLabel
            grid: {
                top: '28%',
                left: '15%', // Increased space on the left
                right: '4%',
                bottom: '25%',
                containLabel: false // Let the large left margin handle all spacing
            },
            xAxis: {
                type: 'category',
                data: tableData.map(row => row.Year),
                name: 'Year',
                nameLocation: 'middle',
                nameGap: 35,
                nameTextStyle: axisLabelStyle,
                axisLabel: { ...tickStyle }
            },
            // ✅ FIX 2: Increase nameGap to push title into the gutter
            yAxis: {
                type: 'value',
                name: `Electricity (${unit})`,
                nameLocation: 'middle',
                nameGap: 110, // Increased gap to push the title far to the left
                nameTextStyle: axisLabelStyle,
                axisLabel: {
                    formatter: (val) => (typeof val === 'number' ? val.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : val),
                    ...tickStyle
                }
            },
            // ✅ FIX 3: Push the Y-axis brush slightly to the right
            dataZoom: [
                { type: 'slider', xAxisIndex: 0, bottom: '5%', height: 15 },
                { type: 'slider', yAxisIndex: 0, left: '30px', width: 15 }, // Moved from 15px to 30px
                { type: 'inside', xAxisIndex: 0 },
                { type: 'inside', yAxisIndex: 0 }
            ],
            series: series
        };
    }, [tableData, unit, activeSectorName, convertValue, colorConfig, hiddenSeries]);


    if (isLoading) return <div className="flex flex-col items-center justify-center h-48 text-slate-500"><Loader2 className="animate-spin mb-2" size={32} /><p className="text-sm font-semibold">Loading {scenarioName}...</p></div>;
    if (error) return <div className="text-center p-3 text-red-600 bg-red-50 rounded-md text-xs">{error}</div>;
    if (!tableData || tableData.length === 0) return <div className="text-center p-3 text-slate-500 bg-slate-50 rounded-md text-xs">No data for this sector.</div>;

    return (
        <div className="space-y-2">
            <div className="bg-slate-50/50 rounded-lg border border-slate-200 p-1">
                {lineChartOptions ?
                    <ReactECharts option={lineChartOptions} style={{ height: '320px', width: '100%' }} notMerge={true} lazyUpdate={true} />
                    : <div className="text-center p-2 text-slate-500 text-xs">No chart data.</div>
                }
            </div>
            <div className="bg-white rounded-lg border border-slate-200 p-2">
                <h3 className="text-sm font-bold text-slate-800 mb-1.5">Tabular Results: <span className="text-indigo-600">{activeSectorName}</span></h3>
                <div className="overflow-x-auto max-h-[55vh] rounded-md border">
                    <table className="w-full text-xs">
                        <thead className="bg-slate-100 sticky top-0"><tr>{Object.keys(tableData[0]).map(key => <th key={key} className="px-2 py-1 font-semibold text-left text-slate-600">{key}</th>)}</tr></thead>
                        <tbody className="divide-y divide-slate-200">{tableData.map((row, rIdx) => <tr key={rIdx} className="hover:bg-slate-50">{Object.entries(row).map(([key, val]) => <td key={`${rIdx}-${key}`} className="px-2 py-1 whitespace-nowrap text-slate-700">{formatCellData(key, val)}</td>)}</tr>)}</tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};


// Helper component for comparing two consolidated scenarios
const ConsolidatedCompareView = ({ viewType, setViewType, scenario1Name, scenario2Name, data1, data2, loading1, loading2, error1, error2, unit, allSectors, convertValue, formatCellData, axisLabelStyle, tickStyle, colorConfig, consolidatedState1, consolidatedState2, onLegendClick, onZoomChange }) => {
    const renderColumn = (scenarioName, data, isLoading, error, colorClass, state) => {
        const scenarioSectors = useMemo(() => {
            if (!data || data.length === 0) return [];
            const firstRowKeys = Object.keys(data[0]);
            return firstRowKeys.filter(key => !['Year', 'Gross Total', 'T&D Loss (%)', 'T&D Losses', 'Total'].includes(key));
        }, [data]);

        const chartableData = useMemo(() => {
            if (!data || data.length === 0) return [];
            return data.map(row => {
                const newRow = { Year: row.Year };
                scenarioSectors.forEach(sector => { if (row[sector] !== undefined) { newRow[sector] = convertValue(row[sector], unit); } });
                newRow['T&D Losses'] = convertValue(row['T&D Losses'], unit);
                newRow['Total'] = convertValue(row['Total'], unit);
                return newRow;
            });
        }, [data, scenarioSectors, unit, convertValue]);

        const stackedBarDataKeys = useMemo(() => {
            if (!data || data.length === 0) return [];
            const firstRowKeys = Object.keys(data[0]);
            // Include all keys except Year, Total, and percentage columns
            return firstRowKeys.filter(key =>
                key !== 'Year' && key !== 'Total' && !key.includes('(%)') && key !== 'Gross Total' && key !== 'Net Total'
            );
        }, [data]);

        const stackedBarColors = useMemo(() => colorConfig?.sectors ? stackedBarDataKeys.map(key => key === 'T&D Losses' ? '#ef4444' : colorConfig.sectors[key] || '#3b82f6') : stackedBarDataKeys.map((key, index) => key === 'T&D Losses' ? '#ef4444' : ['#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#f97316', '#a855f7', '#14b8a6'][index % 8]), [colorConfig, stackedBarDataKeys]);

        const stackedAreaDataKeys = useMemo(() => {
            if (!data || data.length === 0) return [];
            const firstRowKeys = Object.keys(data[0]);
            // Include all keys except Year and percentage columns
            return firstRowKeys.filter(key =>
                key !== 'Year' && !key.includes('(%)') && key !== 'Gross Total' && key !== 'Net Total'
            );
        }, [data]);

        const stackedAreaColors = useMemo(() => {
            const fallbackColors = ['#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#f97316', '#a855f7', '#14b8a6'];
            return stackedAreaDataKeys.map((key, index) => {
                if (key === 'T&D Losses') return '#ef4444';
                if (key === 'Total') return '#1e293b';
                const sectorIndex = allSectors.indexOf(key);
                return colorConfig?.sectors?.[key] || fallbackColors[sectorIndex % fallbackColors.length];
            });
        }, [colorConfig, stackedAreaDataKeys, allSectors]);

        if (isLoading) return <div className="w-full h-full flex justify-center items-center p-4 bg-white rounded-lg border"><Loader2 className="animate-spin text-indigo-500" size={28} /></div>;
        if (error) return <div className="w-full h-full flex flex-col justify-center items-center text-center p-3 bg-red-50 text-red-700 rounded-lg border border-red-200"><XCircle size={24} className="mb-2" /><p className="font-semibold text-xs leading-tight">Error loading data:</p><p className="text-xs mt-1">{error}</p></div>;
        if (!data || data.length === 0) return <div className="w-full h-full text-center p-4 bg-slate-50 rounded-lg border text-xs">No data available.</div>;

        return (
            <div className="space-y-1.5">
                <h2 className={`text-base font-bold text-center text-slate-700`}>Scenario: <span className={colorClass}>{scenarioName}</span></h2>
                <div className="bg-white rounded-lg border border-slate-200 p-1">
                    {viewType === 'Area Chart' && <AreaChartComponent data={chartableData} dataKeys={stackedAreaDataKeys} unit={unit} height={320} xAxisLabel={{ value: 'Year', style: axisLabelStyle }} yAxisLabel={{ value: `Electricity (${unit})`, style: axisLabelStyle }} tickStyle={tickStyle} colors={stackedAreaColors} onLegendClick={(name) => onLegendClick('area', scenarioName, name)} hiddenSeriesNames={state?.areaChartHiddenSectors} onZoomChange={(min, max) => onZoomChange('area', scenarioName, min, max)} initialXAxisRange={state?.areaChartZoom} />}
                    {viewType === 'Bar Chart' && <StackedBarChartComponent data={chartableData} dataKeys={stackedBarDataKeys} unit={unit} showLineMarkers={true} height={320} xAxisLabel={{ value: 'Year', style: axisLabelStyle }} yAxisLabel={{ value: `Electricity (${unit})`, style: axisLabelStyle }} tickStyle={tickStyle} colors={stackedBarColors} onLegendClick={(name) => onLegendClick('bar', scenarioName, name)} hiddenSeriesNames={state?.stackedBarChartHiddenSectors} onZoomChange={(min, max) => onZoomChange('bar', scenarioName, min, max)} initialXAxisRange={state?.stackedBarChartZoom} />}
                </div>
                <div className="bg-white rounded-lg border border-slate-200 p-2">
                    <h3 className="text-sm font-bold text-slate-800 mb-1.5">Tabular Results</h3>
                    <div className="overflow-x-auto max-h-[55vh] rounded-md border">
                        <table className="w-full text-xs">
                            <thead className="bg-slate-100 sticky top-0"><tr>{Object.keys(data[0]).map(key => <th key={key} className="px-2 py-1 font-semibold text-left text-slate-600 whitespace-nowrap">{key}</th>)}</tr></thead>
                            <tbody className="divide-y divide-slate-200">{data.map((row, rIdx) => <tr key={rIdx} className="hover:bg-slate-50">{Object.entries(row).map(([key, val]) => <td key={`${rIdx}-${key}`} className="px-2 py-1 whitespace-nowrap text-slate-700">{formatCellData(key, val)}</td>)}</tr>)}</tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div>
            <div className="flex justify-center items-center mb-1">
                <div className="flex bg-slate-200/70 p-0.5 rounded-md border border-slate-300/50">
                    <button onClick={() => setViewType('Area Chart')} className={`flex items-center gap-1.5 px-2 py-1 text-xs font-semibold rounded ${viewType === 'Area Chart' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600'}`}>Area Chart</button>
                    <button onClick={() => setViewType('Bar Chart')} className={`flex items-center gap-1.5 px-2 py-1 text-xs font-semibold rounded ${viewType === 'Bar Chart' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600'}`}>Bar Chart</button>
                </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                {renderColumn(scenario1Name, data1, loading1, error1, "text-indigo-600", consolidatedState1)}
                {renderColumn(scenario2Name, data2, loading2, error2, "text-green-600", consolidatedState2)}
            </div>
        </div>
    );
};

// Main Component
const DemandVisualization = ({ setSelected, activeProject }) => {
    const [scenariosState, setScenariosState] = useState(() => {
        const savedState = sessionStorage.getItem('demandVizState');
        return savedState ? JSON.parse(savedState) : {};
    });

    const [selectedScenario, setSelectedScenario] = useState(() => {
        const savedScenario = sessionStorage.getItem('demandVizSelectedScenario');
        return savedScenario || '';
    });

    const [preComparisonEndYear, setPreComparisonEndYear] = useState(null);
    const [maxEndYear, setMaxEndYear] = useState(2100);
    const [comparisonYears, setComparisonYears] = useState(null);
    const [scenarios, setScenarios] = useState([]);
    const [sectors, setSectors] = useState([]);
    const [isLoadingScenarios, setIsLoadingScenarios] = useState(true);
    const [isModelPanelOpen, setIsModelPanelOpen] = useState(false);
    const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [sectorTableData, setSectorTableData] = useState([]);
    const [isSectorDataLoading, setIsSectorDataLoading] = useState(false);
    const [tableError, setTableError] = useState('');
    const [consolidatedData, setConsolidatedData] = useState([]);
    const [isLoadingConsolidatedData, setIsLoadingConsolidatedData] = useState(false);
    const [consolidatedError, setConsolidatedError] = useState('');
    const [sectorTableDataCompare, setSectorTableDataCompare] = useState([]);
    const [isSectorDataLoadingCompare, setIsSectorDataLoadingCompare] = useState(false);
    const [tableErrorCompare, setTableErrorCompare] = useState('');
    const [isDownloaded, setIsDownloaded] = useState(false);
    const [compareConsolidated1, setCompareConsolidated1] = useState({ loading: false, error: null, data: [] });
    const [compareConsolidated2, setCompareConsolidated2] = useState({ loading: false, error: null, data: [] });

    const { colorConfig, fetchColorConfig } = useSettingsStore();

    const modelButtonRef = useRef(null);
    const modelPanelRef = useRef(null);

    const apexAxisLabelStyle = { fontWeight: 'bold', color: '#000000', fontSize: '16px' };
    const apexTickStyle = { colors: ['#000000'], fontWeight: 'bold', fontSize: '12px' };
    const conversionFactorsFromMwh = useMemo(() => ({ MWh: 1, KWh: 1000, GWh: 0.001, TWh: 0.000001 }), []);

    const currentScenarioState = useMemo(() => {
        const scenarioState = scenariosState[selectedScenario];
        const defaultEndYear = maxEndYear < 2100 ? String(maxEndYear) : '2030';

        const defaultStateShape = {
            startYear: '2006',
            endYear: defaultEndYear,
            unit: 'MWh',
            activeSelection: sectors.length > 0 ? sectors[0] : null,
            consolidatedView: 'Data Table',
            consolidatedCompareView: 'Area Chart',
            scenariosToCompare: null,
            modelSelections: {},
            demandType: 'gross',
            sector: { hiddenSeries: [], zoomRange: null },
            consolidated: { areaChartHiddenSectors: [], areaChartZoom: null, stackedBarChartHiddenSectors: [], stackedBarChartZoom: null }
        };

        let effectiveState = { ...defaultStateShape, ...scenarioState };
        if (parseInt(effectiveState.endYear, 10) > maxEndYear) {
            effectiveState.endYear = String(maxEndYear);
        }
        return effectiveState;
    }, [scenariosState, selectedScenario, sectors, maxEndYear]);

    const updateCurrentScenarioState = useCallback((newState) => {
        setScenariosState(prev => {
            const currentState = prev[selectedScenario] || {};
            return { ...prev, [selectedScenario]: { ...currentState, ...newState } };
        });
    }, [selectedScenario]);

    const formatCellData = useCallback((key, value) => {
        if (key === 'Year') return value;
        if (key === 'T&D Loss (%)') {
            const numValue = parseFloat(value);
            return isNaN(numValue) ? '0.00%' : `${(numValue * 100).toFixed(2)}%`;
        }
        const num = parseFloat(value);
        if (value == null || isNaN(num)) return (0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const convertedValue = num * (conversionFactorsFromMwh[currentScenarioState.unit] || 1);
        return convertedValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }, [currentScenarioState.unit, conversionFactorsFromMwh]);

    const convertValue = useCallback((valueInMwh, targetUnit) => {
        if (typeof valueInMwh !== 'number' || isNaN(valueInMwh) || !targetUnit) return valueInMwh;
        return valueInMwh * (conversionFactorsFromMwh[targetUnit] || 1);
    }, [conversionFactorsFromMwh]);

    // --- Start Effects ---

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (modelPanelRef.current && !modelPanelRef.current.contains(event.target) && modelButtonRef.current && !modelButtonRef.current.contains(event.target)) {
                setIsModelPanelOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        const fetchInitialData = async () => {
            if (!activeProject?.path) {
                setScenarios([]); setSelectedScenario(''); setIsLoadingScenarios(false); return;
            }
            setIsLoadingScenarios(true);
            try {
                const scenariosRes = await axios.get('/project/scenarios', { params: { projectPath: activeProject.path } });
                const fetchedScenarios = scenariosRes.data.scenarios || [];
                setScenarios(fetchedScenarios);
                const savedScenario = sessionStorage.getItem('demandVizSelectedScenario');
                if (savedScenario && fetchedScenarios.includes(savedScenario)) {
                    setSelectedScenario(savedScenario);
                } else if (fetchedScenarios.length > 0) {
                    setSelectedScenario(fetchedScenarios[0]);
                } else {
                    setSelectedScenario('');
                }
            } catch (err) {
                console.error("Error fetching scenarios:", err); setScenarios([]); setSelectedScenario('');
            } finally {
                setIsLoadingScenarios(false);
            }
        };
        fetchInitialData();
    }, [activeProject]);

    useEffect(() => {
        if (!activeProject?.path) return;
        const fetchScenarioMeta = async (scenario, projectPath) => {
            try {
                const res = await axios.get(`/project/scenarios/${scenario}/meta`, { params: { projectPath } });
                if (res.data.success && res.data.meta.targetYear) return parseInt(res.data.meta.targetYear, 10);
            } catch (error) { console.warn(`Metadata for "${scenario}" not found. Using default.`); }
            return 2100;
        };
        const updateMaxYear = async () => {
            if (currentScenarioState.scenariosToCompare) {
                const year1 = await fetchScenarioMeta(currentScenarioState.scenariosToCompare.scenario1, activeProject.path);
                const year2 = await fetchScenarioMeta(currentScenarioState.scenariosToCompare.scenario2, activeProject.path);
                setComparisonYears({ [currentScenarioState.scenariosToCompare.scenario1]: year1, [currentScenarioState.scenariosToCompare.scenario2]: year2 });
                setMaxEndYear(Math.max(year1, year2));
            } else if (selectedScenario) {
                const targetYear = await fetchScenarioMeta(selectedScenario, activeProject.path);
                setMaxEndYear(targetYear);
                setComparisonYears(null);
                if (parseInt(currentScenarioState.endYear, 10) > targetYear) {
                    updateCurrentScenarioState({ endYear: String(targetYear) });
                }
            } else {
                setMaxEndYear(2100);
            }
        };
        updateMaxYear();
    }, [selectedScenario, currentScenarioState.scenariosToCompare, activeProject?.path]);

    // Scenario configuration loading effect
    useEffect(() => {
        if (!selectedScenario || !activeProject?.path) {
            setSectors([]); return;
        }
        const projectPath = activeProject.path;
        const loadScenarioConfig = async () => {
            try {
                const sectorsRes = await axios.get(`/project/scenarios/${selectedScenario}/sectors`, { params: { projectPath } });
                const fetchedSectors = sectorsRes.data.sectors || [];
                
                const regularSectors = fetchedSectors.filter(s => s !== 'Consolidated_Results');
                setSectors(regularSectors);

                fetchColorConfig(projectPath, regularSectors);

                const existsRes = await axios.get(`/project/scenarios/${selectedScenario}/consolidated/exists`, { params: { projectPath } });
                setIsDownloaded(existsRes.data.exists);

                setScenariosState(prev => {
                    const current = prev[selectedScenario];
                    let newActiveSelection = current?.activeSelection;
                    const allValidSelections = [...regularSectors, 'T&D Losses', 'Consolidated Results'];
                    if (!allValidSelections.includes(newActiveSelection)) {
                        newActiveSelection = regularSectors[0] || 'Consolidated Results';
                    }
                    return { ...prev, [selectedScenario]: { ...current, activeSelection: newActiveSelection } };
                });
            } catch (err) {
                console.error('Failed to load scenario configuration:', err); setTableError('Failed to load scenario configuration.'); setSectors([]);
            }
        };
        loadScenarioConfig();
    }, [selectedScenario, activeProject, fetchColorConfig]);

    // Sector Data Fetching Effect
    useEffect(() => {
        if (!activeProject?.path || !selectedScenario || !currentScenarioState.activeSelection || currentScenarioState.activeSelection === 'Consolidated Results' || currentScenarioState.activeSelection === 'T&D Losses') {
            setSectorTableData([]); setTableError(''); return;
        }
        const projectPath = activeProject.path;
        const activeSelection = currentScenarioState.activeSelection;
        const startYear = currentScenarioState.startYear;
        const endYear = currentScenarioState.endYear;

        const fetchSectorData = async (scenario, setLoading, setData, setError) => {
            setLoading(true); setError('');
            const scenarioMaxYear = comparisonYears ? comparisonYears[scenario] : maxEndYear;
            const effectiveEndYear = Math.min(parseInt(endYear, 10), scenarioMaxYear);
            try {
                const res = await axios.get(`/project/scenarios/${scenario}/sectors/${activeSelection}`, { params: { projectPath, startYear, endYear: String(effectiveEndYear) } });
                setData(res.data.data || []);
            } catch (err) { setError(`Failed to load data for ${activeSelection}.`); setData([]); } finally { setLoading(false); }
        };

        fetchSectorData(selectedScenario, setIsSectorDataLoading, setSectorTableData, setTableError);
        if (currentScenarioState.scenariosToCompare) {
            fetchSectorData(currentScenarioState.scenariosToCompare.scenario2, setIsSectorDataLoadingCompare, setSectorTableDataCompare, setTableErrorCompare);
        } else {
            setSectorTableDataCompare([]); setTableErrorCompare('');
        }
    }, [selectedScenario, currentScenarioState.activeSelection, currentScenarioState.startYear, currentScenarioState.endYear, currentScenarioState.scenariosToCompare, activeProject?.path, comparisonYears, maxEndYear]);

    // Consolidated Data Fetching Effect
    useEffect(() => {
        const fetchAllConsolidatedData = async () => {
            const projectPath = activeProject?.path;
            const { activeSelection, startYear, endYear, scenariosToCompare, modelSelections } = currentScenarioState;

            if (!projectPath || !selectedScenario || activeSelection !== 'Consolidated Results') {
                // Clear data if not on consolidated view, but keep comparison data intact if we switch back later
                if (activeSelection !== 'Consolidated Results') {
                    setIsLoadingConsolidatedData(false);
                    setConsolidatedData([]);
                    setConsolidatedError('');
                }
                return;
            }

            // --- Single Scenario Logic ---
            const fetchMainConsolidated = async (selections, demandType) => {
                setIsLoadingConsolidatedData(true); setConsolidatedError('');
                const effectiveEndYear = Math.min(parseInt(endYear, 10), maxEndYear);
                try {
                    const res = await axios.post(`/project/scenarios/${selectedScenario}/consolidated`, { projectPath, startYear, endYear: String(effectiveEndYear), selections, demandType });
                    setConsolidatedData(res.data.data || []);
                } catch (err) { setConsolidatedError('Failed to load consolidated data.'); setConsolidatedData([]); } finally { setIsLoadingConsolidatedData(false); }
            };

            // --- Comparison Scenario Logic ---
            const fetchComparisonConsolidated = async () => {
                const fetchDynamic = async (scenario, setData) => {
                    setData({ loading: true, error: null, data: [] });
                    const scenarioMaxYear = comparisonYears ? comparisonYears[scenario] : maxEndYear;
                    const effectiveEndYear = Math.min(parseInt(endYear, 10), scenarioMaxYear);

                    try {
                        let scenarioSelections = scenariosState[scenario]?.modelSelections || {};

                        // *** START FIX: Ensure model selections exist before calculation ***
                        if (Object.keys(scenarioSelections).length === 0) {
                            console.warn(`No pre-existing model selections found for scenario: ${scenario}. Fetching defaults.`);

                            // 1. Fetch sectors for the comparison scenario
                            const sectorsRes = await axios.get(`/project/scenarios/${scenario}/sectors`, { params: { projectPath } });
                            const scenarioSectorsList = (sectorsRes.data.sectors || []).filter(s => s !== 'Consolidated_Results');

                            // 2. Fetch available models for the scenario
                            const modelsRes = await axios.get(`/project/scenarios/${scenario}/models`, { params: { projectPath } });
                            const newSelections = {};
                            const modelsData = modelsRes.data.models;

                            // 3. Assign default models (first available model per sector)
                            scenarioSectorsList.forEach(sector => {
                                const availableModels = modelsData[sector];
                                if (availableModels && availableModels.length > 0) {
                                    newSelections[sector] = availableModels[0];
                                }
                            });

                            if (Object.keys(newSelections).length > 0) {
                                scenarioSelections = newSelections;
                                // Save these defaults back to the main state to avoid re-fetching
                                setScenariosState(prev => ({
                                    ...prev,
                                    [scenario]: { ...(prev[scenario] || {}), modelSelections: newSelections }
                                }));
                            } else {
                                throw new Error(`No models available to calculate consolidated results for scenario: ${scenario}`);
                            }
                        }
                        // *** END FIX ***

                        const res = await axios.post(`/project/scenarios/${scenario}/consolidated`, { projectPath, startYear, endYear: String(effectiveEndYear), selections: scenarioSelections, demandType: currentScenarioState.demandType });
                        setData({ loading: false, error: null, data: res.data.data || [] });

                    } catch (err) {
                        console.error(`Failed to generate dynamic data for ${scenario}:`, err);
                        setData({ loading: false, error: err.message || 'Failed to generate dynamic data.', data: [] });
                    }
                };

                if (scenariosToCompare) {
                    fetchDynamic(scenariosToCompare.scenario1, setCompareConsolidated1);
                    fetchDynamic(scenariosToCompare.scenario2, setCompareConsolidated2);
                }
            };

            if (scenariosToCompare) {
                // In comparison mode, clear single view data and run comparison fetch logic
                setConsolidatedData([]);
                fetchComparisonConsolidated();
            } else {
                // In single view mode, clear comparison data and run single fetch logic
                setCompareConsolidated1({ loading: false, error: null, data: [] });
                setCompareConsolidated2({ loading: false, error: null, data: [] });

                if (sectors.length > 0) { // Ensure sectors are loaded before proceeding
                    let currentSelections = modelSelections;
                    if (!currentSelections || Object.keys(currentSelections).length === 0) {
                        try {
                            const modelsRes = await axios.get(`/project/scenarios/${selectedScenario}/models`, { params: { projectPath } });
                            const newSelections = {};
                            sectors.forEach(sector => { const availableModels = modelsRes.data.models[sector]; if (availableModels && availableModels.length > 0) newSelections[sector] = availableModels[0]; });
                            if (Object.keys(newSelections).length > 0) {
                                updateCurrentScenarioState({ modelSelections: newSelections });
                                currentSelections = newSelections;
                            } else {
                                setConsolidatedError('No models available for this scenario.');
                                setIsLoadingConsolidatedData(false);
                                return;
                            }
                        } catch (err) {
                            setConsolidatedError('Failed to set default models.');
                            setIsLoadingConsolidatedData(false);
                            return;
                        }
                    }
                    if (currentSelections && Object.keys(currentSelections).length > 0) {
                        fetchMainConsolidated(currentSelections, currentScenarioState.demandType);
                    } else {
                        setConsolidatedError('Model selections are missing.');
                        setIsLoadingConsolidatedData(false);
                    }
                } else if (!isLoadingScenarios) {
                    // If sectors array is empty but scenarios are loaded, show minor error or prompt.
                    // console.warn("Sectors not yet loaded, skipping consolidated data fetch.");
                }
            }
        };
        fetchAllConsolidatedData();
    }, [activeProject, selectedScenario, currentScenarioState.activeSelection, currentScenarioState.startYear, currentScenarioState.endYear, currentScenarioState.scenariosToCompare, currentScenarioState.modelSelections, currentScenarioState.demandType, scenariosState, sectors, comparisonYears, maxEndYear, updateCurrentScenarioState, isLoadingScenarios]);

    useEffect(() => {
        if (Object.keys(scenariosState).length > 0) sessionStorage.setItem('demandVizState', JSON.stringify(scenariosState));
        if (selectedScenario) sessionStorage.setItem('demandVizSelectedScenario', selectedScenario);
    }, [scenariosState, selectedScenario]);

    // --- Start Callbacks ---

    const handleDownloadAndSave = useCallback(async () => {
        if (consolidatedData.length === 0) { toast.error("No data to save."); return; }
        setIsSaving(true);
        setIsSaved(false);
        try {
            await axios.post('/project/save-consolidated', { projectPath: activeProject.path, scenarioName: selectedScenario, data: consolidatedData });
            setIsDownloaded(true);
            setIsSaved(true);
            toast.success('Changes saved successfully!');
            setTimeout(() => {
                setIsSaved(false);
            }, 2000);
        } catch (error) {
            toast.error(error.response?.data?.message || 'An error occurred while saving.');
        } finally {
            setIsSaving(false);
        }
    }, [consolidatedData, activeProject?.path, selectedScenario]);

    const handleCompare = useCallback((scenarios) => {
        setPreComparisonEndYear(currentScenarioState.endYear);
        if (scenarios.length > 0) updateCurrentScenarioState({ scenariosToCompare: { scenario1: selectedScenario, scenario2: scenarios[0] } });
        setIsCompareModalOpen(false);
    }, [selectedScenario, updateCurrentScenarioState, currentScenarioState.endYear]);

    const stopComparing = useCallback(() => {
        const updates = { scenariosToCompare: null, activeSelection: sectors.length > 0 ? sectors[0] : 'Consolidated Results' };
        if (preComparisonEndYear) updates.endYear = preComparisonEndYear;
        updateCurrentScenarioState(updates);
        setCompareConsolidated1({ loading: false, error: null, data: [] });
        setCompareConsolidated2({ loading: false, error: null, data: [] });
        setComparisonYears(null);
        setPreComparisonEndYear(null);
    }, [sectors, updateCurrentScenarioState, preComparisonEndYear]);

    const handleModelSave = useCallback((selections) => {
        updateCurrentScenarioState({ modelSelections: selections });
        setIsModelPanelOpen(false);
    }, [updateCurrentScenarioState]);

    const handleLegendClick = useCallback((chartType, scenarioName, seriesName) => {
        setScenariosState(prev => {
            const current = prev[scenarioName] || {};
            let newScenarioState = { ...current };
            const getUpdatedHiddenSeries = (currentHiddenSeries, seriesName) => {
                const hidden = (currentHiddenSeries || []).includes(seriesName) ? (currentHiddenSeries || []).filter(name => name !== seriesName) : [...(currentHiddenSeries || []), seriesName];
                return hidden;
            };
            if (chartType === 'line') {
                const sectorState = newScenarioState.sector || {};
                newScenarioState.sector = { ...sectorState, hiddenSeries: getUpdatedHiddenSeries(sectorState.hiddenSeries, seriesName) };
            } else if (chartType === 'area') {
                const consolidatedState = newScenarioState.consolidated || {};
                newScenarioState.consolidated = { ...consolidatedState, areaChartHiddenSectors: getUpdatedHiddenSeries(consolidatedState.areaChartHiddenSectors, seriesName) };
            } else if (chartType === 'bar') {
                const consolidatedState = newScenarioState.consolidated || {};
                newScenarioState.consolidated = { ...consolidatedState, stackedBarChartHiddenSectors: getUpdatedHiddenSeries(consolidatedState.stackedBarChartHiddenSectors, seriesName) };
            } else return prev;
            return { ...prev, [scenarioName]: newScenarioState };
        });
    }, []);

    const handleZoomChange = useCallback((chartType, scenarioName, min, max) => {
        setScenariosState(prev => {
            const current = prev[scenarioName] || {};
            const zoomData = { min, max };
            let newScenarioState = { ...current };
            if (chartType === 'line') newScenarioState.sector = { ...(newScenarioState.sector || {}), zoomRange: zoomData };
            else if (chartType === 'area') newScenarioState.consolidated = { ...(newScenarioState.consolidated || {}), areaChartZoom: zoomData };
            else if (chartType === 'bar') newScenarioState.consolidated = { ...(newScenarioState.consolidated || {}), stackedBarChartZoom: zoomData };
            else return prev;
            return { ...prev, [scenarioName]: newScenarioState };
        });
    }, []);

    // --- Start Memoized Chart Data ---

    const chartableData = useMemo(() => {
        if (!consolidatedData || consolidatedData.length === 0) return [];
        return consolidatedData.map(row => {
            const newRow = { Year: row.Year };
            sectors.forEach(sector => newRow[sector] = convertValue(row[sector], currentScenarioState.unit));
            newRow['T&D Losses'] = convertValue(row['T&D Losses'], currentScenarioState.unit);
            newRow['Total'] = convertValue(row['Total'], currentScenarioState.unit);
            return newRow;
        });
    }, [consolidatedData, sectors, currentScenarioState.unit, convertValue]);

    const stackedAreaDataKeys = useMemo(() => {
        if (!consolidatedData || consolidatedData.length === 0) return [];
        const firstRowKeys = Object.keys(consolidatedData[0]);
        // Include all keys except Year and percentage columns
        return firstRowKeys.filter(key =>
            key !== 'Year' && !key.includes('(%)') && key !== 'Gross Total' && key !== 'Net Total'
        );
    }, [consolidatedData]);

    const stackedBarDataKeys = useMemo(() => {
        if (!consolidatedData || consolidatedData.length === 0) return [];
        const firstRowKeys = Object.keys(consolidatedData[0]);
        // Include all keys except Year, Total, and percentage columns
        return firstRowKeys.filter(key =>
            key !== 'Year' && key !== 'Total' && !key.includes('(%)') && key !== 'Gross Total' && key !== 'Net Total'
        );
    }, [consolidatedData]);

    const stackedAreaColors = useMemo(() => {
        const fallbackColors = ['#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#f97316', '#a855f7', '#14b8a6'];
        return stackedAreaDataKeys.map((key) => {
            if (key === 'T&D Losses') return '#ef4444';
            if (key === 'Total') return '#1e293b';
            const sectorIndex = sectors.indexOf(key);
            return colorConfig?.sectors?.[key] || fallbackColors[sectorIndex >= 0 ? sectorIndex % fallbackColors.length : 0];
        });
    }, [colorConfig, sectors, stackedAreaDataKeys]);

    const stackedBarColors = useMemo(() => {
        const fallbackColors = ['#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#f97316', '#a855f7', '#14b8a6'];
        return stackedBarDataKeys.map((key) => {
            if (key === 'T&D Losses') return '#ef4444';
            const sectorIndex = sectors.indexOf(key);
            return colorConfig?.sectors?.[key] || fallbackColors[sectorIndex >= 0 ? sectorIndex % fallbackColors.length : 0];
        });
    }, [colorConfig, sectors, stackedBarDataKeys]);

    // --- Start Render Logic ---

    const navigationButtons = useMemo(() => [...sectors, 'T&D Losses', 'Consolidated Results'], [sectors]);
    const consolidatedViewTabs = [{ name: 'Data Table', icon: <Table size={12} /> }, { name: 'Area Chart', icon: <AreaIcon size={12} /> }, { name: 'Bar Chart', icon: <BarChart3 size={12} /> }];
    const PageLoader = ({ text = "Loading Data..." }) => <div className="flex flex-col items-center justify-center h-full text-slate-500"><Loader2 className="animate-spin mb-2" size={32} /><p className="text-sm font-semibold">{text}</p></div>;

    const renderActiveContent = () => {
        const isActualSector = sectors.includes(currentScenarioState.activeSelection);

        if (!activeProject?.path) return <div className="flex flex-col items-center justify-center h-full text-slate-500"><XCircle size={32} className="text-red-500 mb-2" /><p className="font-semibold text-lg">No Active Project</p><p className="text-sm mt-1">Please create or load a project.</p></div>;
        if (isLoadingScenarios) return <PageLoader text="Loading scenarios..." />;
        if (scenarios.length === 0) return <div className="flex flex-col items-center justify-center h-full text-slate-500"><XCircle size={32} className="text-red-500 mb-2" /><p className="font-semibold text-lg">No Scenarios Found</p><p className="text-sm mt-1">Please create a new scenario.</p></div>;

        if (currentScenarioState.activeSelection === 'Consolidated Results') {
            return currentScenarioState.scenariosToCompare ? (
                <ConsolidatedCompareView
                    viewType={currentScenarioState.consolidatedCompareView}
                    setViewType={(view) => updateCurrentScenarioState({ consolidatedCompareView: view })}
                    scenario1Name={currentScenarioState.scenariosToCompare.scenario1}
                    scenario2Name={currentScenarioState.scenariosToCompare.scenario2}
                    data1={compareConsolidated1.data} data2={compareConsolidated2.data}
                    loading1={compareConsolidated1.loading} loading2={compareConsolidated2.loading}
                    error1={compareConsolidated1.error} error2={compareConsolidated2.error}
                    unit={currentScenarioState.unit} allSectors={sectors}
                    convertValue={convertValue} formatCellData={formatCellData}
                    axisLabelStyle={apexAxisLabelStyle} tickStyle={apexTickStyle}
                    colorConfig={colorConfig}
                    consolidatedState1={scenariosState[currentScenarioState.scenariosToCompare.scenario1]?.consolidated}
                    consolidatedState2={scenariosState[currentScenarioState.scenariosToCompare.scenario2]?.consolidated}
                    onLegendClick={handleLegendClick} onZoomChange={handleZoomChange}
                />
            ) : (
                <>
                    <div className="flex justify-between items-center mb-2 px-2">
                        <div className="flex items-center gap-4">
                            <label className="font-semibold text-slate-700 text-sm">Demand Type:</label>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="demandType"
                                        value="gross"
                                        checked={currentScenarioState.demandType === 'gross'}
                                        onChange={(e) => updateCurrentScenarioState({ demandType: e.target.value })}
                                        className="w-4 h-4 text-indigo-600 cursor-pointer"
                                    />
                                    <span className="text-sm font-medium text-slate-700">Gross Demand</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="demandType"
                                        value="net"
                                        checked={currentScenarioState.demandType === 'net'}
                                        onChange={(e) => updateCurrentScenarioState({ demandType: e.target.value })}
                                        className="w-4 h-4 text-indigo-600 cursor-pointer"
                                    />
                                    <span className="text-sm font-medium text-slate-700">Net Demand</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="demandType"
                                        value="onGrid"
                                        checked={currentScenarioState.demandType === 'onGrid'}
                                        onChange={(e) => updateCurrentScenarioState({ demandType: e.target.value })}
                                        className="w-4 h-4 text-indigo-600 cursor-pointer"
                                    />
                                    <span className="text-sm font-medium text-slate-700">On Grid Demand</span>
                                </label>
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-200 mb-1.5">
                        <div className='flex'>
                            {consolidatedViewTabs.map((tab) => <button key={tab.name} onClick={() => updateCurrentScenarioState({ consolidatedView: tab.name })} className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${currentScenarioState.consolidatedView === tab.name ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{React.cloneElement(tab.icon, { size: 15 })} {tab.name}</button>)}
                        </div>
                        {consolidatedData.length > 0 && currentScenarioState.consolidatedView === 'Data Table' && (
                            <button
                                onClick={handleDownloadAndSave}
                                disabled={isSaving || isSaved || isLoadingConsolidatedData}
                                className={`flex items-center justify-center w-32 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-200 ${isSaved ? 'bg-green-500' :
                                    isSaving ? 'cursor-not-allowed bg-gray-400' :
                                        isLoadingConsolidatedData ? 'cursor-not-allowed bg-gray-400' :
                                            isDownloaded ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-600 hover:bg-green-700'
                                    }`}
                            >
                                {isSaved ? (
                                    <CheckCircle size={16} />
                                ) : isSaving ? (
                                    <Loader2 size={16} className="animate-spin" />
                                ) : (
                                    isDownloaded ? <Save size={16} /> : <Download size={16} />
                                )}
                                <span className="ml-2 whitespace-nowrap">
                                    {isSaved ? 'Saved!' : isSaving ? 'Saving...' : isDownloaded ? 'Save Changes' : 'Save'}
                                </span>
                            </button>
                        )}
                    </div>
                    {isLoadingConsolidatedData ? <PageLoader text="Loading Consolidated Data..." /> : consolidatedError ? <div className="text-center p-3 text-red-600 bg-red-50 rounded-md">{consolidatedError}</div> : consolidatedData.length > 0 ?
                        <>
                            {currentScenarioState.consolidatedView === 'Data Table' && <div className="overflow-x-auto max-h-[70vh] rounded-md border"><table className="w-full text-xs"><thead className="bg-slate-100 sticky top-0"><tr>{Object.keys(consolidatedData[0]).map(key => <th key={key} className="px-2 py-1 font-semibold text-left text-slate-600 whitespace-nowrap">{key}</th>)}</tr></thead><tbody className="divide-y divide-slate-200">{consolidatedData.map((row, rIdx) => <tr key={rIdx} className="hover:bg-slate-50">{Object.entries(row).map(([key, val]) => <td key={`${rIdx}-${key}`} className="px-2 py-1 whitespace-nowrap text-slate-700">{formatCellData(key, val)}</td>)}</tr>)}</tbody></table></div>}
                            {currentScenarioState.consolidatedView === 'Area Chart' && <AreaChartComponent data={chartableData} dataKeys={stackedAreaDataKeys} unit={currentScenarioState.unit} height={420} xAxisLabel={{ value: 'Year', style: apexAxisLabelStyle }} yAxisLabel={{ value: `Electricity (${currentScenarioState.unit})`, style: apexAxisLabelStyle }} tickStyle={apexTickStyle} colors={stackedAreaColors} onLegendClick={(name) => handleLegendClick('area', selectedScenario, name)} hiddenSeriesNames={currentScenarioState.consolidated.areaChartHiddenSectors} onZoomChange={(min, max) => handleZoomChange('area', selectedScenario, min, max)} initialXAxisRange={currentScenarioState.consolidated.areaChartZoom} />}
                            {currentScenarioState.consolidatedView === 'Bar Chart' && <StackedBarChartComponent data={chartableData} dataKeys={stackedBarDataKeys} unit={currentScenarioState.unit} showLineMarkers={true} height={420} xAxisLabel={{ value: 'Year', style: apexAxisLabelStyle }} yAxisLabel={{ value: `Electricity (${currentScenarioState.unit})`, style: apexAxisLabelStyle }} tickStyle={apexTickStyle} colors={stackedBarColors} onLegendClick={(name) => handleLegendClick('bar', selectedScenario, name)} hiddenSeriesNames={currentScenarioState.consolidated.stackedBarChartHiddenSectors} onZoomChange={(min, max) => handleZoomChange('bar', selectedScenario, min, max)} initialXAxisRange={currentScenarioState.consolidated.stackedBarChartZoom} />}
                        </> : <div className="text-center p-4 text-slate-500">No consolidated data available.</div>
                    }
                </>
            );
        }

        if (isActualSector) {
            return currentScenarioState.scenariosToCompare ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                    <div><h2 className="text-base font-bold text-center mb-1 text-slate-700">Base: <span className="text-indigo-600">{currentScenarioState.scenariosToCompare.scenario1}</span></h2><ScenarioDataView {...{ scenarioName: currentScenarioState.scenariosToCompare.scenario1, activeSectorName: currentScenarioState.activeSelection, tableData: sectorTableData, isLoading: isSectorDataLoading, error: tableError, unit: currentScenarioState.unit, formatCellData, convertValue, colorConfig, hiddenSeries: [] }} /></div>
                    <div><h2 className="text-base font-bold text-center mb-1 text-slate-700">Comparison: <span className="text-green-600">{currentScenarioState.scenariosToCompare.scenario2}</span></h2><ScenarioDataView {...{ scenarioName: currentScenarioState.scenariosToCompare.scenario2, activeSectorName: currentScenarioState.activeSelection, tableData: sectorTableDataCompare, isLoading: isSectorDataLoadingCompare, error: tableErrorCompare, unit: currentScenarioState.unit, formatCellData, convertValue, colorConfig, hiddenSeries: [] }} /></div>
                </div>
            ) : (<ScenarioDataView {...{ scenarioName: selectedScenario, activeSectorName: currentScenarioState.activeSelection, tableData: sectorTableData, isLoading: isSectorDataLoading, error: tableError, unit: currentScenarioState.unit, formatCellData, convertValue, colorConfig, hiddenSeries: currentScenarioState.sector.hiddenSeries, onLegendClick: (name) => handleLegendClick('line', selectedScenario, name), zoomRange: currentScenarioState.sector.zoomRange, onZoomChange: (min, max) => handleZoomChange('line', selectedScenario, min, max) }} />);
        }

        if (currentScenarioState.activeSelection === 'T&D Losses') return <TDLossesTab projectPath={activeProject.path} scenario={selectedScenario} />;
        return <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 text-center"><p className="font-semibold text-xs text-slate-500">{!selectedScenario ? "Please select a scenario to begin." : "Select an item to view data."}</p></div>;
    };

    return (
        <>
            <Toaster position="top-right" reverseOrder={false} />
            <div className="h-full w-full bg-slate-50 text-slate-800 p-1 font-sans flex flex-col text-xs">
                <header className="flex-shrink-0 w-full flex justify-center items-center mb-2 gap-3 text-sm">
                    <div className="flex items-center gap-x-3"><label className="font-semibold text-slate-600">Scenario</label><select value={selectedScenario} onChange={(e) => setSelectedScenario(e.target.value)} disabled={isLoadingScenarios || scenarios.length === 0 || !!currentScenarioState.scenariosToCompare} className="bg-white border-2 border-slate-300 rounded-lg px-2 py-1.5 font-semibold text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 disabled:bg-slate-100 transition">{isLoadingScenarios ? <option disabled>Loading...</option> : scenarios.length === 0 ? <option value="" disabled>No scenarios</option> : scenarios.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                    <div className="flex items-center gap-x-2"><label className="font-semibold text-slate-600">Start Year</label><input type="number" value={scenarios.length > 0 ? currentScenarioState.startYear : ''} disabled={scenarios.length === 0} onChange={(e) => updateCurrentScenarioState({ startYear: e.target.value })} className="bg-white border-2 border-slate-300 rounded-lg w-24 text-center py-1.5 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 disabled:bg-slate-100" /></div>
                    <div className="flex items-center gap-x-2"><label className="font-semibold text-slate-600">End Year</label><input type="number" value={scenarios.length > 0 ? currentScenarioState.endYear : ''} disabled={scenarios.length === 0} max={maxEndYear} onChange={(e) => { const year = e.target.value; updateCurrentScenarioState({ endYear: parseInt(year, 10) > maxEndYear ? String(maxEndYear) : year }); }} className="bg-white border-2 border-slate-300 rounded-lg w-24 text-center py-1.5 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 disabled:bg-slate-100" /></div>
                    <div className="flex items-center gap-x-2"><label className="font-semibold text-slate-600">Unit</label><select value={currentScenarioState.unit} disabled={scenarios.length === 0} onChange={(e) => updateCurrentScenarioState({ unit: e.target.value })} className="bg-white border-2 border-slate-300 rounded-lg px-2 py-1.5 font-semibold text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition disabled:bg-slate-100"><option value="MWh">MWh</option><option value="GWh">GWh</option><option value="TWh">TWh</option><option value="KWh">KWh</option></select></div>
                    <div className="relative" ref={modelButtonRef}><button onClick={() => setIsModelPanelOpen(prev => !prev)} disabled={isLoadingScenarios || scenarios.length === 0 || !!currentScenarioState.scenariosToCompare} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 disabled:bg-slate-400 transition-all"><Cpu size={14} /> Model Selection</button></div>
                    <div className="relative">{!currentScenarioState.scenariosToCompare ? <button onClick={() => setIsCompareModalOpen(true)} disabled={isLoadingScenarios || scenarios.length < 2} className="flex items-center gap-2 px-3 py-1.5 bg-gray-600 text-white font-semibold rounded-lg shadow-md hover:bg-gray-900 disabled:bg-slate-400 transition-all"><Scale size={14} /> Compare Scenario</button> : <button onClick={stopComparing} className="flex items-center gap-2 px-3 py-1.5 bg-rose-600 text-white font-semibold rounded-lg shadow-md hover:bg-rose-700 transition-all"><XCircle size={14} /> Stop Comparison</button>}</div>
                </header>
                <div className="flex-grow w-full bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                    <div className="flex-shrink-0 p-1 border-b border-slate-200"><div className="w-full overflow-x-auto"><div className="flex gap-1 p-0.5">{navigationButtons.map((buttonName) => { const isActive = currentScenarioState.activeSelection === buttonName; return (<button key={buttonName} onClick={() => updateCurrentScenarioState({ activeSelection: buttonName })} className={`flex-shrink-0 px-2.5 py-1 rounded-md font-semibold whitespace-nowrap border-2 transition-all ${isActive ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm' : 'bg-white text-slate-700 border-transparent hover:border-indigo-500'}`}>{buttonName.replace(/_/g, ' ')}</button>); })}</div></div></div>
                    <div className="flex-grow p-1.5 overflow-y-auto">{renderActiveContent()}</div>
                </div>
            </div>
            <div ref={modelPanelRef}><ModelSelection isOpen={isModelPanelOpen} onClose={() => setIsModelPanelOpen(false)} onSave={handleModelSave} currentSelections={currentScenarioState.modelSelections} scenarioName={selectedScenario} projectPath={activeProject?.path} sectors={sectors} /></div>
            <CompareScenarioModal isOpen={isCompareModalOpen} onClose={() => setIsCompareModalOpen(false)} scenarios={scenarios} currentScenario={selectedScenario} onCompare={handleCompare} />
        </>
    );
};

export { DemandVisualization };