import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Settings, SlidersHorizontal, Package, BarChart3, AreaChart as AreaIcon, Table, BrainCircuit, Loader2 } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import LineChartComponent from '../../components/charts/LineChartComponent';
import CorrelationComponent from './CorrelationComponent';
import AreaChartComponent from '../../components/charts/AreaChartComponent';
import StackedBarChartComponent from '../../components/charts/StackedBarChartComponent';
import ConfigureForecast from './ConfigureForecast';
import ForecastProgress from './ForecastProgress';

const DemandProjection = ({ setSelected, activeProject }) => {
    const [projectName, setProjectName] = useState('');

    const [uiState, setUiState] = useState(() => {
        const savedState = sessionStorage.getItem('dp-uiState');
        if (savedState) {
            const parsedState = JSON.parse(savedState);
            return {
                ...parsedState,
                consolidated: {
                    ...parsedState.consolidated,
                    areaChartHiddenSectors: parsedState.consolidated.areaChartHiddenSectors || [],
                    stackedBarChartHiddenSectors: parsedState.consolidated.stackedBarChartHiddenSectors || [],
                    areaChartZoom: parsedState.consolidated.areaChartZoom || null,
                    stackedBarChartZoom: parsedState.consolidated.stackedBarChartZoom || null,
                },
                sector: {
                    ...parsedState.sector,
                    lineChartHiddenSeries: parsedState.sector.lineChartHiddenSeries || [],
                    lineChartZoom: parsedState.sector.lineChartZoom || null,
                }
            };
        }
        return {
            isConsolidatedView: true,
            consolidated: {
                activeTab: 'Data Table',
                areaChartHiddenSectors: [],
                stackedBarChartHiddenSectors: [],
                areaChartZoom: null,
                stackedBarChartZoom: null,
            },
            sector: {
                activeTab: 'Data Table',
                activeSectorIndex: 0,
                lineChartHiddenSeries: [],
                lineChartZoom: null,
            },
            selectedUnit: 'mwh'
        };
    });

    const [sectors, setSectors] = useState([]);
    const [sectorData, setSectorData] = useState([]);
    const [consolidatedData, setConsolidatedData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isForecastModalOpen, setIsForecastModalOpen] = useState(false);
    const [isForecasting, setIsForecasting] = useState(false);
    const [forecastConfig, setForecastConfig] = useState(null);
    const [scenarioName, setScenarioName] = useState("");

    const { colorConfig, fetchColorConfig } = useSettingsStore();

    const conversionFactors = useMemo(() => ({ mwh: 1, kwh: 1000, gwh: 0.001, twh: 0.000001 }), []);
    const apexAxisLabelStyle = { fontWeight: 'bold', color: '#000000', fontSize: '16px' };
    const apexTickStyle = { colors: ['#000000'], fontWeight: 'bold', fontSize: '12px' };

    useEffect(() => {
        sessionStorage.setItem('dp-uiState', JSON.stringify(uiState));
    }, [uiState]);

    useEffect(() => {
        const loadProjectData = async () => {
            if (!activeProject?.path) {
                setProjectName('');
                setSectors([]);
                setConsolidatedData([]);
                setSectorData([]);
                setIsLoading(false);
                return;
            }

            const isNewProject = projectName && projectName !== activeProject.name;
            if (isNewProject) {
                setUiState(prev => ({
                    isConsolidatedView: true,
                    consolidated: {
                        activeTab: 'Data Table',
                        areaChartHiddenSectors: [],
                        stackedBarChartHiddenSectors: [],
                        areaChartZoom: null,
                        stackedBarChartZoom: null,
                    },
                    sector: {
                        activeTab: 'Data Table',
                        activeSectorIndex: 0,
                        lineChartHiddenSeries: [],
                        lineChartZoom: null,
                    },
                    selectedUnit: 'mwh'
                }));
            }

            setIsLoading(true);
            setProjectName(activeProject.name);

            try {
                const sectorsRes = await axios.get('/project/sectors', { params: { projectPath: activeProject.path } });
                const fetchedSectors = sectorsRes.data.sectors || [];
                setSectors(fetchedSectors);
                await fetchColorConfig(activeProject.path, fetchedSectors);

                setUiState(prev => {
                    const savedIndex = prev.sector.activeSectorIndex;
                    const newIndex = (savedIndex < fetchedSectors.length) ? savedIndex : 0;
                    return { ...prev, sector: { ...prev.sector, activeSectorIndex: newIndex } };
                });

                setIsLoading(false);

            } catch (error) {
                console.error('Error fetching initial project data:', error);
                setIsLoading(false);
            }
        };

        if (activeProject && activeProject.path) {
            loadProjectData();
        } else {
            setIsLoading(false);
            setProjectName('');
            setSectors([]);
            setConsolidatedData([]);
            setSectorData([]);
        }
    }, [activeProject, fetchColorConfig]);

    useEffect(() => {
        const fetchSectorData = async () => {
            if (!activeProject?.path || uiState.sector.activeSectorIndex === null || sectors.length === 0 || uiState.isConsolidatedView) {
                return;
            }
            setIsLoading(true);
            try {
                const res = await axios.post('/project/extract-sector-data', {
                    projectPath: activeProject.path,
                    sectorName: sectors[uiState.sector.activeSectorIndex],
                });
                setSectorData(res.data.data || []);
            } catch (error) {
                console.error('Failed to fetch sector data:', error);
                setSectorData([]);
            } finally {
                setIsLoading(false);
            }
        };
        fetchSectorData();
    }, [activeProject, uiState.sector.activeSectorIndex, uiState.isConsolidatedView, sectors]);

    useEffect(() => {
        const fetchConsolidatedData = async () => {
            if (!activeProject?.path || !uiState.isConsolidatedView || sectors.length === 0) {
                if (uiState.isConsolidatedView && sectors.length === 0) {
                    setConsolidatedData([]);
                }
                return;
            }
            setIsLoading(true);
            try {
                const res = await axios.post('/project/consolidated-electricity', {
                    projectPath: activeProject.path,
                    sectorsOrder: sectors,
                });
                setConsolidatedData(res.data.data || []);
            } catch (err) {
                console.error('❌ Error fetching consolidated data:', err);
                setConsolidatedData([]);
            } finally {
                setIsLoading(false);
            }
        };
        fetchConsolidatedData();
    }, [activeProject, uiState.isConsolidatedView, sectors]);

    const handleStartForecast = (config) => {
        setForecastConfig(config);
        setScenarioName(config.scenarioName);
        setIsForecasting(true);
        setIsForecastModalOpen(false);
    };

    const handleForecastComplete = () => {
        setIsForecasting(false);
        setForecastConfig(null);
        setSelected('Demand Visualization');
    };

    const convertValueForTable = (val) => {
        if (!uiState.selectedUnit || val === null || val === undefined || val === '') return val;
        const cleaned = String(val).replace(/,/g, '');
        const num = parseFloat(cleaned);
        const factor = conversionFactors[uiState.selectedUnit] !== undefined ? conversionFactors[uiState.selectedUnit] : 1;
        const converted = uiState.selectedUnit === 'mwh' ? num : num * factor;
        return isNaN(num) ? val : converted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const handleViewChange = (isConsolidated) => {
        setUiState(prev => ({
            ...prev,
            isConsolidatedView: isConsolidated,
        }));
    };
    const setActiveTab = (tabName) => {
        setUiState(prev => ({
            ...prev,
            [prev.isConsolidatedView ? 'consolidated' : 'sector']: {
                ...prev[prev.isConsolidatedView ? 'consolidated' : 'sector'],
                activeTab: tabName,
            }
        }));
    };
    const setActiveSectorIndex = (index) => {
        setUiState(prev => ({
            ...prev,
            sector: { ...prev.sector, activeSectorIndex: index }
        }));
    };
    const setSelectedUnit = (unit) => {
        setUiState(prev => ({ ...prev, selectedUnit: unit }));
    };

    const PageLoader = () => (
        <div className="flex flex-col items-center justify-center h-48 text-slate-500">
            <Loader2 className="animate-spin mb-2" size={32} />
            <p className="text-sm font-semibold">Loading Project Data...</p>
        </div>
    );

    const NoDataMessage = () => (
        <div className="flex flex-col items-center justify-center h-48 text-slate-500">
            <p className="text-lg font-semibold">No data to show. Please select a project or Create a new .</p>
        </div>
    );

    const handleChartLegendClick = (chartType, seriesName) => {
        setUiState(prev => {
            let currentHidden;
            let targetKey;

            if (chartType === 'area') {
                currentHidden = prev.consolidated.areaChartHiddenSectors;
                targetKey = 'areaChartHiddenSectors';
            } else if (chartType === 'bar') {
                currentHidden = prev.consolidated.stackedBarChartHiddenSectors;
                targetKey = 'stackedBarChartHiddenSectors';
            } else if (chartType === 'line') {
                currentHidden = prev.sector.lineChartHiddenSeries;
                targetKey = 'lineChartHiddenSeries';
            } else {
                return prev;
            }

            const newHidden = currentHidden.includes(seriesName)
                ? currentHidden.filter(name => name !== seriesName)
                : [...currentHidden, seriesName];

            const updatedState = { ...prev };
            if (chartType === 'line') {
                updatedState.sector = { ...updatedState.sector, [targetKey]: newHidden };
            } else {
                updatedState.consolidated = { ...updatedState.consolidated, [targetKey]: newHidden };
            }

            return updatedState;
        });
    };

    const handleChartZoomChange = (chartType, min, max) => {
        setUiState(prev => {
            const updatedState = { ...prev };
            if (chartType === 'line') {
                updatedState.sector = { ...updatedState.sector, lineChartZoom: { min, max } };
            } else {
                updatedState.consolidated = {
                    ...updatedState.consolidated,
                    [chartType === 'area' ? 'areaChartZoom' : 'stackedBarChartZoom']: { min, max }
                };
            }
            return updatedState;
        });
    };

    // Prepare data for the consolidated view, but only with sectors (no T&D Losses or Total)
    const processedConsolidatedDataForChart = useMemo(() => consolidatedData.map(row => {
        const convertedRow = { Year: row.Year };
        sectors.forEach(sector => {
            const val = row[sector] || 0;
            const cleanedVal = parseFloat(String(val).replace(/,/g, ''));
            const factor = conversionFactors[uiState.selectedUnit] !== undefined ? conversionFactors[uiState.selectedUnit] : 1;
            const convertedVal = uiState.selectedUnit === 'mwh' ? cleanedVal : cleanedVal * factor;
            convertedRow[sector] = isNaN(convertedVal) ? 0 : parseFloat(convertedVal.toFixed(2));
        });
        return convertedRow;
    }), [consolidatedData, sectors, uiState.selectedUnit, conversionFactors]);

    const processedSectorDataForChart = useMemo(() => sectorData.map(row => {
        const newRow = { ...row };
        for (const key in row) {
            if (key !== 'Year') {
                const cleanedVal = parseFloat(String(row[key]).replace(/,/g, ''));
                const factor = conversionFactors[uiState.selectedUnit] !== undefined ? conversionFactors[uiState.selectedUnit] : 1;
                const convertedVal = uiState.selectedUnit === 'mwh' ? cleanedVal : cleanedVal * factor;
                newRow[key] = isNaN(convertedVal) ? 0 : parseFloat(convertedVal.toFixed(2));
            }
        }
        return newRow;
    }), [sectorData, uiState.selectedUnit, conversionFactors]);

    // Data keys for the Area Chart and Bar Chart in Demand Projection
    const consolidatedChartKeys = useMemo(() => {
        // Only return sector names for the data keys, as requested.
        return sectors;
    }, [sectors]);

    const consolidatedColors = useMemo(() =>
        colorConfig?.sectors
            ? consolidatedChartKeys.map(sector => colorConfig.sectors[sector] || '#3b82f6')
            : ['#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#f97316', '#a855f7', '#14b8a6'].slice(0, consolidatedChartKeys.length),
        [colorConfig, consolidatedChartKeys]
    );

    const navigationButtons = useMemo(() => [...sectors, 'T&D Losses', 'Consolidated Results'], [sectors]);

    const consolidatedViewTabs = [
        { name: 'Data Table', icon: <Table size={12} /> },
        { name: 'Area Chart', icon: <AreaIcon size={12} /> },
        { name: 'Stacked Bar Chart', icon: <BarChart3 size={12} /> }
    ];

    // *** START: Unit Formatting Logic ***
    /**
     * Formats the unit string according to the requested format (e.g., "MWh", "KWh").
     * @param {string} unit - The lowercase unit value (e.g., "mwh", "kwh").
     * @returns {string} The formatted unit string.
     */
    const formatUnitDisplay = (unit) => {
        if (!unit || unit.length < 3) return unit.toUpperCase();
        // Capitalize first letter + lowercase middle part + capitalize "Wh" part.
        // For "kwh": "K" + "w" + "h" => "K" + "w" + "h". Desired: KWh.
        // Let's break it down: "kwh" -> "K" + "Wh". "mwh" -> "M" + "Wh".
        const prefix = unit.charAt(0).toUpperCase();
        return prefix + 'Wh';
    };

    // Get the currently selected unit in the desired display format.
    const currentFormattedUnit = formatUnitDisplay(uiState.selectedUnit);
    // *** END: Unit Formatting Logic ***

    const renderConsolidatedTable = () => {
        if (!consolidatedData || consolidatedData.length === 0) {
            return <div className="text-center p-10 text-slate-500">No consolidated data available.</div>;
        }
        return (
            <div className="w-full overflow-auto max-h-[78vh] rounded-md border border-slate-200">
                <table className="w-full text-left table-auto">
                    <thead className="bg-slate-100 text-slate-600 sticky top-0 z-10">
                        <tr>
                            {Object.keys(consolidatedData[0] || {}).map((key, index) => (
                                <th key={key} className={`px-2 py-1 font-medium border-b-2 border-slate-200 whitespace-nowrap ${index === 0 ? 'sticky left-0 z-20 bg-slate-100' : ''}`}>
                                    {key}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {consolidatedData.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 group">
                                {Object.entries(row).map(([key, val], i) => (
                                    <td key={i} className={`px-2 py-1 text-slate-700 font-semibold whitespace-nowrap ${i === 0 ? 'sticky left-0 bg-white group-hover:bg-slate-50' : ''}`}>
                                        {key === 'Year' ? val : convertValueForTable(val)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    const renderSectorTable = () => {
        if (!sectorData || sectorData.length === 0) {
            return <div className="text-center p-10 text-slate-500">No data available for this sector.</div>;
        }
        return (
            <div className="w-full overflow-auto max-h-[78vh] rounded-md border border-slate-200">
                <table className="w-full text-left table-auto">
                    <thead className="bg-slate-100 text-slate-600 sticky top-0 z-10">
                        <tr>
                            {Object.keys(sectorData[0] || {}).map((key) => (
                                <th key={key} className="px-2 py-1 font-medium border-b-2 border-slate-200 whitespace-nowrap">
                                    {key}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {sectorData.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                                {Object.entries(row).map(([key, val], i) => (
                                    <td key={i} className={`px-2 py-1 text-slate-700 font-semibold whitespace-nowrap`}>
                                        {key === 'Electricity' ? convertValueForTable(val) : val}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    if (isForecasting) {
        return (
            <div className="min-h-screen w-full bg-slate-100 flex flex-col items-center justify-center font-sans p-4">
                <ForecastProgress
                    scenarioName={scenarioName}
                    onComplete={handleForecastComplete}
                    onClose={() => setIsForecasting(false)}
                />
            </div>
        );
    }

    return (
        <div className="h-full w-full bg-slate-50 text-slate-800 p-1 font-sans flex flex-col text-xs">
            <header className="flex-shrink-0 w-full flex justify-center items-center mb-1 gap-1.5">
                <div className="flex items-center gap-2 text-sm">
                    <div className="inline-flex bg-slate-200/70 p-0.5 rounded-md border border-slate-300/50">
                        <button onClick={() => handleViewChange(true)} className={`flex items-center gap-1 px-2.5 py-1.25 font-semibold rounded-md ${uiState.isConsolidatedView ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600'}`}>
                            <Package size={13} /> Consolidated View
                        </button>
                        <button onClick={() => handleViewChange(false)} className={`flex items-center gap-1 px-2.5 py-1.25 font-semibold rounded-md ${!uiState.isConsolidatedView ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600'}`}>
                            <SlidersHorizontal size={13} /> Sector View
                        </button>
                    </div>
                    <div className="flex items-center space-x-2">
                        <label htmlFor="unit-select" className="font-semibold text-slate-700">Unit</label>
                        {/* MODIFICATION: Apply formatUnitDisplay to dropdown options */}
                        <select id="unit-select" value={uiState.selectedUnit} onChange={(e) => setSelectedUnit(e.target.value)} className="rounded-lg border-2 border-slate-300 bg-white px-2 py-1.25 font-semibold text-slate-800 transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50">
                            {['kwh', 'mwh', 'gwh', 'twh'].map((unit) => (<option key={unit} value={unit}>{formatUnitDisplay(unit)}</option>))}
                        </select>
                    </div>
                    <button onClick={() => setIsForecastModalOpen(true)} className="flex items-center gap-1.5 px-2.5 py-1.25 bg-indigo-600 text-white font-semibold rounded-md shadow-sm hover:bg-indigo-700 transition-all">
                        <Settings size={15} /> Configure Forecast
                    </button>
                </div>
            </header>
            <main className="flex-grow w-full flex flex-col">
                {!uiState.isConsolidatedView && (
                    <div className="w-full mb-1 flex-shrink-0">
                        <div className="bg-white rounded-lg border border-slate-200/80 shadow-sm p-1">
                            <div className="w-full overflow-x-auto">
                                <div className="flex gap-1 w-max min-w-full">
                                    {sectors.map((sector, index) => (
                                        <button key={index} onClick={() => setActiveSectorIndex(index)} className={`flex-shrink-0 px-2.5 py-1 rounded-md font-semibold whitespace-nowrap border-2 transition-all ${uiState.sector.activeSectorIndex === index ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm' : 'bg-white text-slate-700 border-transparent hover:border-indigo-500'}`}>
                                            {sector}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                <div className="w-full flex-grow bg-white rounded-lg border border-slate-200/80 shadow-sm p-1">
                    {!activeProject?.path ? <NoDataMessage /> :
                        isLoading ? <PageLoader /> :
                            uiState.isConsolidatedView ? (
                                <>
                                    <div className="flex justify-between items-center border-b border-slate-200 mb-1">
                                        <div className="flex justify-center flex-grow">
                                            {[{ name: 'Data Table', icon: <Table /> }, { name: 'Area Chart', icon: <AreaIcon /> }, { name: 'Stacked Bar Chart', icon: <BarChart3 /> }].map((tab) => (
                                                <button key={tab.name} onClick={() => setActiveTab(tab.name)} className={`flex items-center gap-1.5 px-2 py-1 text-xs font-semibold border-b-2 -mb-px ${uiState.consolidated.activeTab === tab.name ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                                                    {React.cloneElement(tab.icon, { size: 13 })} {tab.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="mt-1.5">
                                        {uiState.consolidated.activeTab === 'Data Table' ? (
                                            renderConsolidatedTable()
                                        ) : uiState.consolidated.activeTab === 'Area Chart' ? (
                                            <AreaChartComponent
                                                data={processedConsolidatedDataForChart}
                                                dataKeys={consolidatedChartKeys}
                                                onLegendClick={(seriesName) => handleChartLegendClick('area', seriesName)}
                                                hiddenSeriesNames={uiState.consolidated.areaChartHiddenSectors}
                                                onZoomChange={(min, max) => handleChartZoomChange('area', min, max)}
                                                initialXAxisRange={uiState.consolidated.areaChartZoom}
                                                unit={currentFormattedUnit} // MODIFICATION: Pass formatted unit to chart tooltip
                                                title="Consolidated Chart"
                                                height={420}
                                                colors={consolidatedColors}
                                                xAxisLabel={{ value: 'Year', style: apexAxisLabelStyle }}
                                                yAxisLabel={{ value: `Electricity (${currentFormattedUnit})`, style: apexAxisLabelStyle }} // MODIFICATION: Update Y-axis label
                                                tickStyle={apexTickStyle}
                                            />
                                        ) : (
                                            <StackedBarChartComponent
                                                data={processedConsolidatedDataForChart}
                                                dataKeys={consolidatedChartKeys}
                                                onLegendClick={(seriesName) => handleChartLegendClick('bar', seriesName)}
                                                hiddenSeriesNames={uiState.consolidated.stackedBarChartHiddenSectors}
                                                onZoomChange={(min, max) => handleChartZoomChange('bar', min, max)}
                                                initialXAxisRange={uiState.consolidated.stackedBarChartZoom}
                                                unit={currentFormattedUnit} // MODIFICATION: Pass formatted unit to chart tooltip
                                                showLineMarkers={true}
                                                height={420}
                                                colors={consolidatedColors}
                                                xAxisLabel={{ value: 'Year', style: apexAxisLabelStyle }}
                                                yAxisLabel={{ value: `Electricity (${currentFormattedUnit})`, style: apexAxisLabelStyle }} // MODIFICATION: Update Y-axis label
                                                tickStyle={apexTickStyle}
                                            />
                                        )}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="flex justify-center border-b border-slate-200">
                                        {[{ name: 'Data Table', icon: <Table /> }, { name: 'Line Chart', icon: <BarChart3 /> }, { name: 'Correlations', icon: <BrainCircuit /> }].map((tab) => (
                                            <button key={tab.name} onClick={() => setActiveTab(tab.name)} className={`flex items-center gap-1.5 px-3 py-1 font-semibold border-b-2 -mb-px ${uiState.sector.activeTab === tab.name ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                                                {React.cloneElement(tab.icon, { size: 14 })} {tab.name}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="mt-1.5">
                                        {uiState.sector.activeTab === 'Data Table' ? (
                                            renderSectorTable()
                                        ) : uiState.sector.activeTab === 'Line Chart' ? (
                                            <LineChartComponent
                                                data={processedSectorDataForChart}
                                                title={`Year vs Electricity (${sectors[uiState.sector.activeSectorIndex]})`}
                                                xKey="Year"
                                                yKeys={['Electricity']}
                                                colors={['#4F46E5']}
                                                legendLabels={[uiState.selectedUnit ? `Electricity (${currentFormattedUnit})` : 'Electricity']} // MODIFICATION: Update legend label
                                                height={320}
                                                xAxisLabel={{ value: 'Year', style: apexAxisLabelStyle }}
                                                yAxisLabel={{ value: `Electricity (${currentFormattedUnit})`, style: apexAxisLabelStyle }} // MODIFICATION: Update Y-axis label
                                                tickStyle={apexTickStyle}
                                                onLegendClick={(seriesName) => handleChartLegendClick('line', seriesName)}
                                                hiddenSeriesNames={uiState.sector.lineChartHiddenSeries}
                                                onZoomChange={(min, max) => handleChartZoomChange('line', min, max)}
                                                initialXAxisRange={uiState.sector.lineChartZoom}
                                                unit={currentFormattedUnit} // MODIFICATION: Pass formatted unit to chart tooltip
                                            />
                                        ) : (
                                            <CorrelationComponent rawData={sectorData} />
                                        )}
                                    </div>
                                </>
                            )
                    }
                </div>
            </main>
            <ConfigureForecast isOpen={isForecastModalOpen} onClose={() => setIsForecastModalOpen(false)} onApply={handleStartForecast} />
            {isForecasting && (
                <ForecastProgress
                    scenarioName={scenarioName}
                    onComplete={handleForecastComplete}
                    onClose={() => setIsForecasting(false)}
                />
            )}
        </div>
    );
};

export default DemandProjection;