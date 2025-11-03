import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import axios from 'axios';
import AreaChartComponent from '../../components/charts/AreaChartComponent';
import StackedBarChartComponent from '../../components/charts/StackedBarChartComponent';
import { 
    Loader2, 
    AreaChart as AreaIcon, 
    BarChart3 as BarIcon, 
    FileSpreadsheet, 
    Network,
    TrendingUp,
    Sparkles 
} from 'lucide-react';

// PyPSA Components
import NetworkSelector from '../../components/pypsa/NetworkSelector';

// Network View Components (separated by type)
import SingleNetworkView from './SingleNetworkView';
import MultiYearNetworkView from './MultiYearNetworkView';

const ViewResults = ({ activeProject }) => {
    // View mode: 'excel' or 'network'
    const [viewMode, setViewMode] = useState('excel');

    // Excel Results State
    const [folders, setFolders] = useState([]);
    const [selectedFolder, setSelectedFolder] = useState('');
    const [sheets, setSheets] = useState([]);
    const [selectedSheet, setSelectedSheet] = useState('');
    const [sheetData, setSheetData] = useState([]);
    const [chartType, setChartType] = useState('Area');

    // Network Analysis State
    const [selectedScenario, setSelectedScenario] = useState('');
    const [selectedNetwork, setSelectedNetwork] = useState('');

    // Multi-Year Detection State
    const [multiYearInfo, setMultiYearInfo] = useState(null);
    const [loadingMultiYearInfo, setLoadingMultiYearInfo] = useState(false);

    // Ref to track last fetched scenario (prevent duplicate fetches)
    const lastFetchedScenarioRef = useRef(null);
    const multiYearFetchAbortControllerRef = useRef(null);

    // Loading states
    const [loadingFolders, setLoadingFolders] = useState(false);
    const [loadingSheets, setLoadingSheets] = useState(false);
    const [loadingData, setLoadingData] = useState(false);

    useEffect(() => {
        if (activeProject?.path) {
            setLoadingFolders(true);
            axios.get('/project/optimization-folders', { params: { projectPath: activeProject.path } })
                .then(res => {
                    setFolders(res.data.folders);
                    if (res.data.folders.length > 0) {
                        setSelectedFolder(res.data.folders[0]);
                    }
                })
                .catch(err => console.error("Error fetching folders:", err))
                .finally(() => setLoadingFolders(false));
        }
    }, [activeProject]);

    useEffect(() => {
        if (selectedFolder && activeProject?.path) {
            setLoadingSheets(true);
            setSheets([]);
            setSelectedSheet('');
            setSheetData([]);
            axios.get('/project/optimization-sheets', { params: { projectPath: activeProject.path, folderName: selectedFolder } })
                .then(res => {
                    setSheets(res.data.sheets);
                    if (res.data.sheets.length > 0) {
                        setSelectedSheet(res.data.sheets[0]);
                    }
                })
                .catch(err => console.error("Error fetching sheets:", err))
                .finally(() => setLoadingSheets(false));
        }
    }, [selectedFolder, activeProject]);

    useEffect(() => {
        if (selectedSheet && selectedFolder && activeProject?.path) {
            setLoadingData(true);
            setSheetData([]);
            axios.get('/project/optimization-sheet-data', { params: { projectPath: activeProject.path, folderName: selectedFolder, sheetName: selectedSheet } })
                .then(res => {
                    setSheetData(res.data.data);
                })
                .catch(err => console.error("Error fetching sheet data:", err))
                .finally(() => setLoadingData(false));
        }
    }, [selectedSheet, selectedFolder, activeProject]);

    const dataKeys = useMemo(() =>
        sheetData.length > 0 ? Object.keys(sheetData[0]).filter(key => key.toLowerCase() !== 'year') : [],
        [sheetData]
    );

    // Project path for network analysis
    const projectPath = activeProject?.path;

    // Fetch multi-year information (memoized with useCallback)
    const fetchMultiYearInfo = useCallback(async (scenario) => {
        if (lastFetchedScenarioRef.current === scenario) {
            return;
        }

        if (multiYearFetchAbortControllerRef.current) {
            multiYearFetchAbortControllerRef.current.abort();
        }

        const abortController = new AbortController();
        multiYearFetchAbortControllerRef.current = abortController;

        setLoadingMultiYearInfo(true);
        setMultiYearInfo(null);

        try {
            const response = await axios.get('/project/pypsa/multi-year-info', {
                params: {
                    projectPath: activeProject.path,
                    scenarioName: scenario
                },
                signal: abortController.signal
            });

            if (response.data.success) {
                setMultiYearInfo(response.data);
                lastFetchedScenarioRef.current = scenario;
            }
        } catch (error) {
            if (error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
                console.log('Multi-year info fetch canceled');
            } else {
                console.error('Error fetching multi-year info:', error);
                setMultiYearInfo(null);
            }
        } finally {
            if (!abortController.signal.aborted) {
                setLoadingMultiYearInfo(false);
            }
        }
    }, [activeProject?.path]);

    const handleNetworkSelect = useCallback((scenario, network) => {
        setSelectedScenario(scenario);
        setSelectedNetwork(network);

        if (lastFetchedScenarioRef.current !== scenario) {
            lastFetchedScenarioRef.current = null;
        }
    }, []);

    useEffect(() => {
        if (viewMode === 'network' && selectedScenario && !selectedNetwork) {
            fetchMultiYearInfo(selectedScenario);
        }
    }, [viewMode, selectedScenario, selectedNetwork, fetchMultiYearInfo]);

    const isMultiYear = multiYearInfo && multiYearInfo.is_multi_year;

    return (
        <div className="flex flex-col h-full bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
            {/* Modern Header with Gradient */}
            <header className="bg-white border-b border-slate-200 shadow-sm">
                <div className="px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                                Results Dashboard
                            </h1>
                            <p className="text-sm text-slate-600 mt-1">
                                {viewMode === 'excel' ? 'Optimization Results Analysis' : 'Network Performance Metrics'}
                            </p>
                        </div>

                        {/* Enhanced View Mode Toggle */}
                        <div className="flex items-center gap-2 bg-slate-100 rounded-xl p-1.5 shadow-inner">
                            <button
                                onClick={() => setViewMode('excel')}
                                className={`
                                    flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm transition-all duration-200
                                    ${viewMode === 'excel'
                                        ? 'bg-white text-blue-600 shadow-md scale-105'
                                        : 'text-slate-600 hover:text-slate-800'
                                    }
                                `}
                            >
                                <FileSpreadsheet size={18} />
                                Excel Results
                            </button>
                            <button
                                onClick={() => setViewMode('network')}
                                className={`
                                    flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm transition-all duration-200
                                    ${viewMode === 'network'
                                        ? 'bg-white text-blue-600 shadow-md scale-105'
                                        : 'text-slate-600 hover:text-slate-800'
                                    }
                                `}
                            >
                                <Network size={18} />
                                Network Analysis
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden">
                {viewMode === 'excel' ? (
                    /* Excel Results View */
                    <div className="flex h-full">
                        {/* Enhanced Sidebar */}
                        <aside className="w-80 bg-white border-r border-slate-200 shadow-lg flex flex-col">
                            <div className="p-6 border-b border-slate-200 bg-gradient-to-br from-blue-50 to-indigo-50">
                                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    <TrendingUp className="text-blue-600" size={20} />
                                    Data Selection
                                </h2>
                                <p className="text-xs text-slate-600 mt-1">Configure your analysis view</p>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                {/* Folder Selection */}
                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-slate-700">
                                        Optimization Folder
                                    </label>
                                    {loadingFolders ? (
                                        <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                                            <Loader2 className="animate-spin text-blue-600" size={16} />
                                            <span className="text-sm text-slate-600">Loading folders...</span>
                                        </div>
                                    ) : (
                                        <select
                                            value={selectedFolder}
                                            onChange={(e) => setSelectedFolder(e.target.value)}
                                            className="w-full px-4 py-2.5 bg-white border-2 border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all hover:border-slate-300"
                                        >
                                            {folders.map(folder => (
                                                <option key={folder} value={folder}>{folder}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>

                                {/* Sheet Selection */}
                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-slate-700">
                                        Data Sheet
                                    </label>
                                    {loadingSheets ? (
                                        <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                                            <Loader2 className="animate-spin text-blue-600" size={16} />
                                            <span className="text-sm text-slate-600">Loading sheets...</span>
                                        </div>
                                    ) : (
                                        <select
                                            value={selectedSheet}
                                            onChange={(e) => setSelectedSheet(e.target.value)}
                                            className="w-full px-4 py-2.5 bg-white border-2 border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all hover:border-slate-300"
                                        >
                                            {sheets.map(sheet => (
                                                <option key={sheet} value={sheet}>{sheet}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>

                                {/* Chart Type Selection */}
                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-slate-700">
                                        Visualization Type
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => setChartType('Area')}
                                            className={`
                                                flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all
                                                ${chartType === 'Area'
                                                    ? 'border-blue-500 bg-blue-50 shadow-md'
                                                    : 'border-slate-200 bg-white hover:border-slate-300'
                                                }
                                            `}
                                        >
                                            <AreaIcon size={24} className={chartType === 'Area' ? 'text-blue-600' : 'text-slate-400'} />
                                            <span className={`text-xs font-medium ${chartType === 'Area' ? 'text-blue-600' : 'text-slate-600'}`}>
                                                Area Chart
                                            </span>
                                        </button>
                                        <button
                                            onClick={() => setChartType('Bar')}
                                            className={`
                                                flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all
                                                ${chartType === 'Bar'
                                                    ? 'border-blue-500 bg-blue-50 shadow-md'
                                                    : 'border-slate-200 bg-white hover:border-slate-300'
                                                }
                                            `}
                                        >
                                            <BarIcon size={24} className={chartType === 'Bar' ? 'text-blue-600' : 'text-slate-400'} />
                                            <span className={`text-xs font-medium ${chartType === 'Bar' ? 'text-blue-600' : 'text-slate-600'}`}>
                                                Bar Chart
                                            </span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </aside>

                        {/* Main Chart Area */}
                        <main className="flex-1 p-8 overflow-y-auto">
                            <div className="max-w-7xl mx-auto">
                                {loadingData ? (
                                    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-16">
                                        <div className="flex flex-col items-center justify-center">
                                            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                                            <p className="text-lg font-semibold text-slate-700">Loading data...</p>
                                            <p className="text-sm text-slate-500 mt-2">This may take a moment</p>
                                        </div>
                                    </div>
                                ) : sheetData.length > 0 ? (
                                    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
                                        <div className="mb-6 pb-6 border-b border-slate-200">
                                            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                                <Sparkles className="text-blue-600" size={22} />
                                                {selectedSheet}
                                            </h3>
                                            <p className="text-sm text-slate-600 mt-1">
                                                From {selectedFolder}
                                            </p>
                                        </div>

                                        <div className="min-h-[500px]">
                                            {chartType === 'Area' ? (
                                                <AreaChartComponent data={sheetData} dataKeys={dataKeys} />
                                            ) : (
                                                <StackedBarChartComponent data={sheetData} dataKeys={dataKeys} />
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-16">
                                        <div className="text-center">
                                            <FileSpreadsheet className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                                            <h3 className="text-xl font-semibold text-slate-700 mb-2">No Data Available</h3>
                                            <p className="text-slate-500">
                                                Select a folder and sheet to view results
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </main>
                    </div>
                ) : (
                    /* Network Analysis View */
                    <>
                        {isMultiYear ? (
                            <MultiYearNetworkView
                                projectPath={projectPath}
                                selectedScenario={selectedScenario}
                                multiYearInfo={multiYearInfo}
                            />
                        ) : (
                            <div className="flex-1 p-6 overflow-y-auto">
                                <div className="max-w-7xl mx-auto space-y-6">
                                    <NetworkSelector
                                        projectPath={projectPath}
                                        onSelect={handleNetworkSelect}
                                        selectedScenario={selectedScenario}
                                        selectedNetwork={selectedNetwork}
                                    />

                                    {selectedScenario && selectedNetwork ? (
                                        <SingleNetworkView
                                            projectPath={projectPath}
                                            selectedScenario={selectedScenario}
                                            selectedNetwork={selectedNetwork}
                                        />
                                    ) : (
                                        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-16">
                                            <div className="text-center">
                                                <Network className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                                                <h3 className="text-xl font-semibold text-slate-700 mb-2">
                                                    No Network Selected
                                                </h3>
                                                <p className="text-slate-500">
                                                    Please select a scenario and network file to begin analysis
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default ViewResults;