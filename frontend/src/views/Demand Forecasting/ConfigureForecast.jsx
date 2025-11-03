import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Settings, X, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import axios from 'axios';

const ALL_METHOD_OPTIONS = ['SLR', 'MLR', 'WAM'];
const DEFAULT_SCENARIO_NAME = 'Project_Demand_V1';

const ConfigureForecast = ({ isOpen, onClose, onApply }) => {
    const [scenarioName, setScenarioName] = useState(DEFAULT_SCENARIO_NAME);
    const [targetYear, setTargetYear] = useState('');
    const [excludeCovid, setExcludeCovid] = useState(true);
    const [sectors, setSectors] = useState([]);
    const [existingScenarios, setExistingScenarios] = useState([]);
    const [selectedMethodsMap, setSelectedMethodsMap] = useState({});
    const [mlrParametersMap, setMlrParametersMap] = useState({});
    const [dropdownOpen, setDropdownOpen] = useState({});
    const [correlationMap, setCorrelationMap] = useState({});
    const [wamWindowSizeMap, setWamWindowSizeMap] = useState({});
    const [sectorRowCounts, setSectorRowCounts] = useState({});
    const [sectorDataMap, setSectorDataMap] = useState({});
    const dropdownRefs = useRef({});
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // duplicate check (for warning only)
    const isNameDuplicate = useMemo(() =>
        existingScenarios.some(existingName => existingName.toLowerCase() === scenarioName.trim().toLowerCase()),
        [scenarioName, existingScenarios]
    );

    // form validity: name non-empty and year valid. Duplicate no longer blocks.
    const isFormValid = useMemo(() => {
        const isNameValid = scenarioName.trim() !== '';
        const isYearValid = targetYear.trim() !== '' && !isNaN(targetYear) && Number(targetYear) >= 2025;
        return isNameValid && isYearValid;
    }, [scenarioName, targetYear]);

    useEffect(() => {
        if (!isOpen) return;

        const currentProjectString = sessionStorage.getItem('activeProject');
        if (!currentProjectString) return;
        const currentProject = JSON.parse(currentProjectString);
        if (!currentProject?.path) return;

        setError('');
        setIsLoading(false);

        // pre-fill default name when modal opens
        setScenarioName(DEFAULT_SCENARIO_NAME);
        setTargetYear('');

        axios.get('/project/scenarios', { params: { projectPath: currentProject.path } })
            .then(res => setExistingScenarios(res.data.scenarios || []))
            .catch(err => console.error('Could not fetch existing scenarios', err));

        axios.get('/project/sectors', { params: { projectPath: currentProject.path } })
            .then(async (res) => {
                const fetchedSectors = res.data.sectors || [];
                setSectors(fetchedSectors);
                const methodMap = {}, mlrMap = {}, dropMap = {}, wamMap = {}, newCorrelationMap = {}, rowCountMap = {}, dataMap = {};
                for (const sector of fetchedSectors) {
                    methodMap[sector] = [...ALL_METHOD_OPTIONS];
                    dropMap[sector] = false;
                    dropMap[`${sector}_mlr`] = false;
                    wamMap[sector] = 3;
                    try {
                        const { data } = await axios.post('/project/extract-sector-data', { projectPath: currentProject.path, sectorName: sector });
                        const rows = data?.data || [];
                        rowCountMap[sector] = rows.length;
                        dataMap[sector] = rows;
                        const corrRes = await axios.post('/project/correlation', { data: rows });
                        const result = corrRes.data?.correlations || [];
                        const paramList = result.map(item => item.variable);
                        newCorrelationMap[sector] = result;
                        mlrMap[sector] = paramList;
                    } catch (err) {
                        console.error(`❌ Error in ${sector}:`, err);
                        newCorrelationMap[sector] = []; mlrMap[sector] = []; rowCountMap[sector] = 3; dataMap[sector] = [];
                    }
                }
                setSectorDataMap(dataMap);
                setSelectedMethodsMap(methodMap); setMlrParametersMap(mlrMap); setDropdownOpen(dropMap);
                setCorrelationMap(newCorrelationMap); setWamWindowSizeMap(wamMap); setSectorRowCounts(rowCountMap);
            })
            .catch((err) => console.error('❌ Error fetching sectors:', err));
    }, [isOpen]);

    useEffect(() => {
        // Only add listener when modal is open
        if (!isOpen) return;

        const handleClickOutside = (event) => {
            // Use updater function to access latest dropdownOpen state without adding to dependencies
            setDropdownOpen((currentDropdownOpen) => {
                const updates = {};
                let hasChanges = false;

                Object.keys(currentDropdownOpen).forEach((key) => {
                    if (currentDropdownOpen[key] && dropdownRefs.current[key] && !dropdownRefs.current[key].contains(event.target)) {
                        updates[key] = false;
                        hasChanges = true;
                    }
                });

                // Only update state if something actually changed
                return hasChanges ? { ...currentDropdownOpen, ...updates } : currentDropdownOpen;
            });
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]); // Only re-run when modal opens/closes

    const handleAddMethod = (sector, method) => setSelectedMethodsMap((prev) => ({ ...prev, [sector]: [...prev[sector], method] }));
    const handleRemoveMethod = (sector, method) => setSelectedMethodsMap((prev) => ({ ...prev, [sector]: prev[sector].filter((m) => m !== method) }));
    const handleAddMlrParameter = (sector, param) => setMlrParametersMap((prev) => ({ ...prev, [sector]: [...(prev[sector] || []), param] }));
    const handleRemoveMlrParameter = (sector, param) => setMlrParametersMap((prev) => ({ ...prev, [sector]: prev[sector].filter((p) => p !== param) }));
    const toggleDropdown = (key) => setDropdownOpen((prev) => ({ ...prev, [key]: !prev[key] }));
    const getMLRDropdownOptions = (sector) => correlationMap?.[sector]?.map((item) => item.variable) || [];

    const handleApplyConfiguration = async () => {
        if (!isFormValid) {
            setError('Please fix the errors before applying.');
            return;
        }
        setError(''); setIsLoading(true);

        const currentProjectString = sessionStorage.getItem('activeProject');
        if (!currentProjectString) {
            setError('No active project found. Please load a project first.');
            setIsLoading(false);
            return;
        }
        const currentProject = JSON.parse(currentProjectString);

        if (!currentProject || !currentProject.path) { setError('Project path is missing. Please reload the project.'); setIsLoading(false); return; }

        // If name duplicates, confirm overwrite (warning-only flow)
        if (isNameDuplicate) {
            const userConfirmed = window.confirm(
                'A scenario with this name already exists. Continuing will replace previous results for this scenario. Do you want to proceed?'
            );
            if (!userConfirmed) {
                setIsLoading(false);
                return;
            }
        }

        const forecastPayload = {
            projectPath: currentProject.path,
            scenarioName: scenarioName.trim(),
            excludeCovidYears: excludeCovid,
            targetYear: targetYear.trim(),
            sectors: sectors.map(sector => ({
                name: sector,
                selectedMethods: selectedMethodsMap[sector] || [],
                mlrParameters: selectedMethodsMap[sector]?.includes('MLR') ? (mlrParametersMap[sector] || []) : [],
                wamWindow: selectedMethodsMap[sector]?.includes('WAM') ? (wamWindowSizeMap[sector] || 3) : null,
                data: sectorDataMap[sector] || []
            })).filter(sector => sector.data.length > 0)
        };
        try {
            await axios.post('/project/forecast', forecastPayload);

            onApply(forecastPayload);
        } catch (err) {
            console.error('❌ Error starting forecast:', err);
            setError(err.response?.data?.message || 'Failed to start the forecast process.');
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-slate-50 w-full max-w-6xl rounded-xl shadow-2xl border border-slate-300 flex flex-col max-h-[90vh]">
                <header className="flex-shrink-0 flex justify-between items-center px-4 py-3 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                        <Settings className="w-6 h-6 text-indigo-600" />
                        <h1 className="text-lg font-bold text-slate-800">Configure Forecast Scenario</h1>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-full text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition">
                        <X className="w-5 h-5" />
                    </button>
                </header>

                <main className="flex-grow p-4 overflow-y-auto">
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-lg flex items-start gap-3 text-sm mb-4">
                            <AlertTriangle className="w-5 h-5 mt-0.5 text-red-600 flex-shrink-0" />
                            <div>
                                <p className="font-bold">Validation Error</p>
                                <p>{error}</p>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Scenario Name <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                value={scenarioName}
                                onChange={(e) => setScenarioName(e.target.value)}
                                className="w-full text-base px-3 py-1.5 bg-white border-2 border-slate-300 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20"
                            />
                            {isNameDuplicate ? (
                                <p className="text-xs text-amber-600 mt-1">
                                    ⚠️ This scenario name already exists. If you continue, the previous results will be replaced.
                                </p>
                            ) : (
                                <p className="text-xs text-slate-500 mt-1">
                                    Default name <span className="font-medium">{DEFAULT_SCENARIO_NAME}</span> is pre-filled — you can rename if needed.
                                </p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Projection Year <span className="text-red-500">*</span></label>
                            <input type="number" value={targetYear} onChange={(e) => setTargetYear(e.target.value)} className="w-full text-base px-3 py-1.5 bg-white border-2 border-slate-300 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20" placeholder="e.g., 2035" min="2025" max="2100" />
                        </div>

                        <div className="pt-7">
                            <label className="inline-flex items-center text-slate-700">
                                <input type="checkbox" checked={excludeCovid} onChange={(e) => setExcludeCovid(e.target.checked)} className="h-4 w-4 rounded border-slate-400 text-indigo-600 focus:ring-indigo-500" />
                                <span className="ml-2 text-sm font-medium">Exclude COVID-19 years (FY 2021,2022,2023)</span>
                            </label>
                        </div>
                    </div>

                    <div>
                        <h2 className="text-lg font-bold text-slate-800 mb-2">Sector-wise Forecast Configuration</h2>
                        <div className="overflow-x-auto border border-slate-200 rounded-lg">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-100 text-slate-700">
                                    <tr>
                                        <th className="px-3 py-2 text-left font-semibold" style={{ width: '20%' }}>Sector / Category</th>
                                        <th className="px-3 py-2 text-left font-semibold" style={{ width: '25%' }}>Forecasting Models</th>
                                        <th className="px-3 py-2 text-left font-semibold" style={{ width: '40%' }}>MLR Input Parameters</th>
                                        <th className="px-3 py-2 text-left font-semibold" style={{ width: '15%' }}>Years Considered for WAM</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {sectors.map((sector) => (
                                        <tr key={sector} className="bg-white">
                                            <td className="px-3 py-1.5 font-semibold text-slate-800">{sector}</td>
                                            <td className="px-3 py-1.5">
                                                <div className="relative" ref={(el) => (dropdownRefs.current[sector] = el)}>
                                                    <button onClick={() => selectedMethodsMap[sector]?.length < 3 && toggleDropdown(sector)} className="w-full bg-white border-2 border-slate-300 hover:border-indigo-500 px-2 py-1 rounded-lg flex items-center justify-between">
                                                        <div className="flex flex-wrap gap-1">
                                                            {selectedMethodsMap[sector]?.map((method) => (
                                                                <span key={method} className="bg-indigo-100 text-indigo-800 text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1.5">
                                                                    {method}
                                                                    <X size={12} onClick={(e) => { e.stopPropagation(); handleRemoveMethod(sector, method); }} className="cursor-pointer hover:text-red-600" />
                                                                </span>
                                                            ))}
                                                        </div>
                                                        {dropdownOpen[sector] ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
                                                    </button>
                                                    {dropdownOpen[sector] && (
                                                        <div className="absolute top-full left-0 mt-1 w-full bg-white border border-slate-300 rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto">
                                                            {ALL_METHOD_OPTIONS.filter((opt) => !selectedMethodsMap[sector]?.includes(opt)).map((method) => (
                                                                <div key={method} className="px-3 py-2 text-slate-700 hover:bg-indigo-50 cursor-pointer" onClick={() => { handleAddMethod(sector, method); toggleDropdown(sector); }}>{method}</div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-3 py-1.5">
                                                {selectedMethodsMap[sector]?.includes('MLR') ? (
                                                    <div className="relative" ref={(el) => (dropdownRefs.current[`${sector}_mlr`] = el)}>
                                                        <button onClick={() => toggleDropdown(`${sector}_mlr`)} className="w-full bg-white border-2 border-slate-300 hover:border-indigo-500 px-2 py-1 rounded-lg flex items-center justify-between min-h-[34px]">
                                                            <div className="flex flex-wrap gap-1">
                                                                {mlrParametersMap[sector]?.length === 0 ? <span className="text-slate-400 text-xs">Select parameters...</span> : mlrParametersMap[sector]?.map((param, idx) => (
                                                                    <span key={idx} className="bg-green-100 text-green-800 text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1.5">
                                                                        {param}
                                                                        <X size={12} onClick={(e) => { e.stopPropagation(); handleRemoveMlrParameter(sector, param); }} className="cursor-pointer hover:text-red-600" />
                                                                    </span>
                                                                ))}
                                                            </div>
                                                            {dropdownOpen[`${sector}_mlr`] ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
                                                        </button>
                                                        {dropdownOpen[`${sector}_mlr`] && (
                                                            <div className="absolute top-full left-0 mt-1 w-full bg-white border border-slate-300 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                                                                {getMLRDropdownOptions(sector).filter(p => !(mlrParametersMap[sector] || []).includes(p)).map((param, idx) => (
                                                                    <div key={idx} className="px-3 py-2 text-slate-700 hover:bg-slate-100 cursor-pointer flex items-center justify-between" onClick={() => handleAddMlrParameter(sector, param)}>
                                                                        {param}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : ( <div className="text-center"><span className="text-slate-400 text-xs">N/A</span></div> )}
                                            </td>
                                            <td className="px-3 py-1.5">
                                                {selectedMethodsMap[sector]?.includes('WAM') ? (
                                                    <select value={wamWindowSizeMap[sector] || 3} onChange={(e) => setWamWindowSizeMap(prev => ({ ...prev, [sector]: parseInt(e.target.value) }))}
                                                        className="w-full bg-white border-2 border-slate-300 text-slate-800 px-3 py-1 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20">
                                                        {Array.from({ length: (sectorRowCounts[sector] || 3) - 2 }, (_, i) => i + 3).map((size) => ( <option key={size} value={size}>{size}</option> ))}
                                                    </select>
                                                ) : ( <div className="text-center"><span className="text-slate-400 text-xs">N/A</span></div> )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </main>

                <footer className="flex-shrink-0 flex justify-end gap-3 px-4 py-3 bg-slate-100 border-t border-slate-200">
                    <button onClick={onClose} disabled={isLoading} className="px-6 py-2 bg-white border border-slate-300 text-slate-800 rounded-lg hover:bg-slate-100 font-semibold disabled:opacity-50 text-sm">Cancel</button>
                    <button
                        onClick={handleApplyConfiguration}
                        disabled={!isFormValid || isLoading}
                        className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                        {isLoading ? 'Processing...' : <><Settings size={16} /> Apply Forecast Configuration</>}
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default ConfigureForecast;
