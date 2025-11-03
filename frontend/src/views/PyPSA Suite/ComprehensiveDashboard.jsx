import React, { useState } from 'react';
import { 
    Loader2, 
    AlertCircle, 
    ChevronDown, 
    ChevronUp, 
    BarChart2, 
    Sparkles,
    Activity,
    Network as NetworkIcon,
    Layers
} from 'lucide-react';
import axios from 'axios';
import usePyPSAAvailability from '../../hooks/usePyPSAAvailability';
import usePyPSAData from '../../hooks/usePyPSAData';

// Import existing components
import NetworkSelector from '../../components/pypsa/NetworkSelector';
import NetworkMetricsCards from '../../components/pypsa/NetworkMetricsCards';
import CapacityChart from '../../components/pypsa/CapacityChart';
import EnergyMixChart from '../../components/pypsa/EnergyMixChart';
import UtilizationChart from '../../components/pypsa/UtilizationChart';
import CostBreakdownChart from '../../components/pypsa/CostBreakdownChart';
import EmissionsChart from '../../components/pypsa/EmissionsChart';

// Import new enhanced visualization components
import PlotViewer from '../../components/pypsa/PlotViewer';
import PlotFilters from '../../components/pypsa/PlotFilters';

const Section = ({ title, subtitle, children, isExpanded = true, onToggle }) => (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden transition-all duration-200 hover:shadow-md">
        <button
            onClick={onToggle}
            className="w-full p-5 flex items-center justify-between hover:bg-gradient-to-r hover:from-blue-50 hover:to-transparent transition-all duration-200 group"
        >
            <div className="text-left">
                <h2 className="text-lg font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
                    {title}
                </h2>
                {subtitle && (
                    <p className="text-sm text-slate-500 mt-1 font-medium">
                        {subtitle}
                    </p>
                )}
            </div>
            <div className={`
                p-2 rounded-lg transition-all duration-200
                ${isExpanded 
                    ? 'bg-blue-100 text-blue-600 rotate-180' 
                    : 'bg-slate-100 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600'
                }
            `}>
                <ChevronDown size={20} />
            </div>
        </button>
        {isExpanded && (
            <div className="p-6 border-t border-slate-100 bg-gradient-to-b from-slate-50/50 to-white">
                {children}
            </div>
        )}
    </div>
);

const LoadingSpinner = ({ message = "Loading data..." }) => (
    <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-4">
            <div className="relative">
                <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
                <div className="absolute inset-0 w-10 h-10 animate-ping text-blue-400 opacity-20">
                    <Loader2 className="w-full h-full" />
                </div>
            </div>
            <span className="text-sm font-medium text-slate-600">{message}</span>
        </div>
    </div>
);

const ComprehensiveDashboard = ({ activeProject }) => {
    const [selectedScenario, setSelectedScenario] = useState('');
    const [selectedNetwork, setSelectedNetwork] = useState('');
    const [activeTab, setActiveTab] = useState('metrics');
    const [expandedSections, setExpandedSections] = useState({
        metrics: true,
        capacity: true,
        energyMix: true,
        utilization: true,
        costs: true,
        emissions: true
    });

    // Enhanced visualization state
    const [plotAvailability, setPlotAvailability] = useState(null);
    const [loadingPlotAvailability, setLoadingPlotAvailability] = useState(false);
    const [selectedPlotType, setSelectedPlotType] = useState(null);
    const [plotFilters, setPlotFilters] = useState({});
    const [plotHtml, setPlotHtml] = useState(null);
    const [generatingPlot, setGeneratingPlot] = useState(false);
    const [plotError, setPlotError] = useState(null);

    const projectPath = activeProject?.path;

    // Get availability information
    const {
        availability,
        loading: loadingAvailability,
        error: availabilityError,
        canShow,
        canAnalyze
    } = usePyPSAAvailability(projectPath, selectedScenario, selectedNetwork);

    // Fetch data based on availability
    const params = projectPath && selectedScenario && selectedNetwork ? {
        projectPath,
        scenarioName: selectedScenario,
        networkFile: selectedNetwork
    } : null;

    const { data: capacities, loading: loadingCapacities } = usePyPSAData(
        '/pypsa/total-capacities',
        params,
        canAnalyze('total_capacities')
    );

    const { data: energyMix, loading: loadingEnergyMix } = usePyPSAData(
        '/pypsa/energy-mix',
        params,
        canAnalyze('energy_mix')
    );

    const { data: utilization, loading: loadingUtilization } = usePyPSAData(
        '/pypsa/utilization',
        params,
        canAnalyze('utilization')
    );

    const { data: costs, loading: loadingCosts } = usePyPSAData(
        '/pypsa/costs',
        params,
        canAnalyze('system_costs')
    );

    const { data: emissions, loading: loadingEmissions } = usePyPSAData(
        '/pypsa/emissions',
        params,
        canAnalyze('emissions')
    );

    const handleNetworkSelect = async (scenario, network) => {
        setSelectedScenario(scenario);
        setSelectedNetwork(network);

        if (activeTab === 'visualizations' && scenario && network && projectPath) {
            await fetchPlotAvailability(scenario, network);
        }
    };

    const toggleSection = (section) => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    // Fetch plot availability
    const fetchPlotAvailability = async (scenario, network) => {
        setLoadingPlotAvailability(true);
        try {
            const response = await axios.get('/project/pypsa/plot/availability', {
                params: {
                    projectPath,
                    scenarioName: scenario,
                    networkFile: network
                }
            });

            if (response.data.success) {
                setPlotAvailability(response.data);
            }
        } catch (error) {
            console.error('Error fetching plot availability:', error);
        } finally {
            setLoadingPlotAvailability(false);
        }
    };

    // Handle tab change
    const handleTabChange = async (tab) => {
        setActiveTab(tab);

        if (tab === 'visualizations' && selectedScenario && selectedNetwork && projectPath && !plotAvailability) {
            await fetchPlotAvailability(selectedScenario, selectedNetwork);
        }
    };

    // Handle plot type selection
    const handlePlotTypeSelect = (plotType) => {
        setSelectedPlotType(plotType);
        setPlotHtml(null);
        setPlotError(null);
    };

    // Handle filters change
    const handleFiltersChange = (newFilters) => {
        setPlotFilters(newFilters);
    };

    // Generate plot
    const handleGeneratePlot = async (filters) => {
        if (!selectedPlotType || !projectPath || !selectedScenario || !selectedNetwork) {
            return;
        }

        setGeneratingPlot(true);
        setPlotError(null);

        try {
            const response = await axios.post('/project/pypsa/plot/generate-from-project', {
                projectPath,
                scenarioName: selectedScenario,
                networkFile: selectedNetwork,
                plot_type: selectedPlotType,
                filters: filters,
                output_format: 'html'
            });

            if (response.data.success) {
                setPlotHtml(response.data.content);
            } else {
                setPlotError('Failed to generate plot');
            }
        } catch (error) {
            console.error('Error generating plot:', error);
            setPlotError(error.response?.data?.detail || error.message || 'Failed to generate plot');
        } finally {
            setGeneratingPlot(false);
        }
    };

    const hasSelection = selectedScenario && selectedNetwork;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
            {/* Modern Header */}
            <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10">
                <div className="px-6 py-5">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                                PyPSA Network Analysis
                            </h1>
                            <p className="text-sm text-slate-600 mt-1 font-medium">
                                Comprehensive energy system modeling and analysis
                            </p>
                        </div>
                    </div>

                    {/* Network Selector */}
                    <NetworkSelector
                        projectPath={projectPath}
                        onSelect={handleNetworkSelect}
                        selectedScenario={selectedScenario}
                        selectedNetwork={selectedNetwork}
                    />

                    {/* Enhanced Tab Navigation */}
                    {hasSelection && (
                        <div className="mt-5 flex gap-2 border-b border-slate-200">
                            <button
                                onClick={() => handleTabChange('metrics')}
                                className={`
                                    flex items-center gap-2 px-5 py-3 font-semibold text-sm transition-all duration-200 relative
                                    ${activeTab === 'metrics'
                                        ? 'text-blue-600'
                                        : 'text-slate-600 hover:text-slate-800'
                                    }
                                `}
                            >
                                <Activity size={18} />
                                Analysis & Metrics
                                {activeTab === 'metrics' && (
                                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-600 to-indigo-600" />
                                )}
                            </button>
                            <button
                                onClick={() => handleTabChange('visualizations')}
                                className={`
                                    flex items-center gap-2 px-5 py-3 font-semibold text-sm transition-all duration-200 relative
                                    ${activeTab === 'visualizations'
                                        ? 'text-blue-600'
                                        : 'text-slate-600 hover:text-slate-800'
                                    }
                                `}
                            >
                                <Sparkles size={18} />
                                Advanced Visualizations
                                {activeTab === 'visualizations' && (
                                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-600 to-indigo-600" />
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </header>

            {/* Main Content */}
            <div className="p-6">
                {hasSelection && activeTab === 'visualizations' ? (
                    <div className="flex gap-6 h-[calc(100vh-280px)]">
                        {/* Visualization Sidebar */}
                        <aside className="w-80 bg-white rounded-xl shadow-lg border border-slate-200 p-6 overflow-y-auto">
                            <div className="mb-6">
                                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-2">
                                    <Layers size={20} className="text-blue-600" />
                                    Visualization Types
                                </h2>
                                <p className="text-xs text-slate-500">
                                    Select a plot type to visualize network data
                                </p>
                            </div>

                            {loadingPlotAvailability ? (
                                <LoadingSpinner message="Loading plot options..." />
                            ) : plotAvailability?.available_plots ? (
                                <div className="space-y-2">
                                    {plotAvailability.available_plots.map(plot => {
                                        const isSelected = selectedPlotType === plot.plot_type;
                                        return (
                                            <button
                                                key={plot.plot_type}
                                                onClick={() => handlePlotTypeSelect(plot.plot_type)}
                                                className={`
                                                    w-full text-left px-4 py-3 rounded-lg font-medium text-sm transition-all duration-200
                                                    ${isSelected
                                                        ? 'bg-blue-600 text-white shadow-lg'
                                                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-2 border-slate-200 hover:border-slate-300'
                                                    }
                                                `}
                                            >
                                                <div className="font-semibold">
                                                    {plot.plot_type.split('_').map(w => 
                                                        w.charAt(0).toUpperCase() + w.slice(1)
                                                    ).join(' ')}
                                                </div>
                                                {plot.description && !isSelected && (
                                                    <div className="text-xs text-slate-500 mt-1">
                                                        {plot.description}
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-slate-500">
                                    <BarChart2 className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                                    <p className="text-sm">No visualizations available</p>
                                </div>
                            )}
                        </aside>

                        {/* Visualization Display Area */}
                        <main className="flex-1 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                            {!selectedPlotType ? (
                                <div className="flex items-center justify-center h-full text-slate-500">
                                    <div className="text-center max-w-md">
                                        <div className="inline-flex p-4 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl mb-4">
                                            <BarChart2 className="w-16 h-16 text-blue-600" />
                                        </div>
                                        <p className="text-xl font-bold text-slate-800 mb-2">
                                            Select a Visualization Type
                                        </p>
                                        <p className="text-sm text-slate-500">
                                            Choose a plot from the sidebar to begin exploring your network data
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="h-full flex flex-col">
                                    {/* Plot Header */}
                                    <header className="p-6 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-transparent">
                                        <h1 className="text-2xl font-bold text-slate-800">
                                            {selectedPlotType.split('_').map(w => 
                                                w.charAt(0).toUpperCase() + w.slice(1)
                                            ).join(' ')}
                                        </h1>
                                    </header>

                                    {/* Filters Section */}
                                    <div className="p-6 border-b border-slate-200 bg-slate-50">
                                        <PlotFilters
                                            plotType={selectedPlotType}
                                            availability={plotAvailability}
                                            filters={plotFilters}
                                            onFiltersChange={handleFiltersChange}
                                            onGenerate={handleGeneratePlot}
                                            generating={generatingPlot}
                                        />
                                    </div>

                                    {/* Plot Display */}
                                    <div className="flex-1 overflow-hidden">
                                        {generatingPlot ? (
                                            <div className="flex items-center justify-center h-full">
                                                <div className="text-center">
                                                    <div className="relative mb-4">
                                                        <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto" />
                                                        <div className="absolute inset-0 w-12 h-12 animate-ping text-blue-400 opacity-20 mx-auto">
                                                            <Loader2 className="w-full h-full" />
                                                        </div>
                                                    </div>
                                                    <span className="text-lg font-semibold text-slate-700">
                                                        Generating visualization...
                                                    </span>
                                                </div>
                                            </div>
                                        ) : plotError ? (
                                            <div className="flex items-center justify-center h-full p-6">
                                                <div className="text-center max-w-md">
                                                    <div className="inline-flex p-4 bg-red-100 rounded-2xl mb-4">
                                                        <AlertCircle className="w-12 h-12 text-red-600" />
                                                    </div>
                                                    <p className="text-lg font-semibold text-red-900 mb-2">{plotError}</p>
                                                    <button
                                                        onClick={() => handleGeneratePlot(plotFilters)}
                                                        className="mt-4 px-6 py-2.5 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors shadow-lg hover:shadow-xl"
                                                    >
                                                        Try Again
                                                    </button>
                                                </div>
                                            </div>
                                        ) : plotHtml ? (
                                            <PlotViewer
                                                plotHtml={plotHtml}
                                                plotType={selectedPlotType}
                                                loading={false}
                                                error={null}
                                                onRefresh={() => handleGeneratePlot(plotFilters)}
                                            />
                                        ) : (
                                            <div className="flex items-center justify-center h-full text-slate-500">
                                                <p className="text-lg">Click "Generate Plot" to create visualization</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </main>
                    </div>
                ) : loadingAvailability ? (
                    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-16">
                        <LoadingSpinner message="Loading network information..." />
                    </div>
                ) : availabilityError ? (
                    <div className="bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-200 rounded-2xl p-8 shadow-lg">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-red-200 rounded-xl">
                                <AlertCircle className="w-6 h-6 text-red-700" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-red-900 mb-2">Error Loading Network</h3>
                                <p className="text-red-700 font-medium">{availabilityError}</p>
                            </div>
                        </div>
                    </div>
                ) : availability ? (
                    <div className="space-y-5 max-w-7xl mx-auto">
                        {/* Network Metrics */}
                        <Section
                            title="Network Overview"
                            subtitle="Key metrics and network information"
                            isExpanded={expandedSections.metrics}
                            onToggle={() => toggleSection('metrics')}
                        >
                            <NetworkMetricsCards availability={availability} />
                        </Section>

                        {/* Capacity Analysis */}
                        {canShow('capacity_bar_chart') && (
                            <Section
                                title="Installed Capacity"
                                subtitle="Total installed capacity by technology"
                                isExpanded={expandedSections.capacity}
                                onToggle={() => toggleSection('capacity')}
                            >
                                {loadingCapacities ? (
                                    <LoadingSpinner message="Loading capacity data..." />
                                ) : (
                                    <CapacityChart data={capacities} />
                                )}
                            </Section>
                        )}

                        {/* Energy Mix */}
                        {canShow('energy_mix_pie') && (
                            <Section
                                title="Energy Generation Mix"
                                subtitle="Distribution of energy generation by carrier"
                                isExpanded={expandedSections.energyMix}
                                onToggle={() => toggleSection('energyMix')}
                            >
                                {loadingEnergyMix ? (
                                    <LoadingSpinner message="Loading energy mix data..." />
                                ) : (
                                    <EnergyMixChart data={energyMix} />
                                )}
                            </Section>
                        )}

                        {/* Utilization */}
                        {canShow('utilization_chart') && (
                            <Section
                                title="Capacity Factors"
                                subtitle="Average utilization of installed capacity"
                                isExpanded={expandedSections.utilization}
                                onToggle={() => toggleSection('utilization')}
                            >
                                {loadingUtilization ? (
                                    <LoadingSpinner message="Loading utilization data..." />
                                ) : (
                                    <UtilizationChart data={utilization} />
                                )}
                            </Section>
                        )}

                        {/* Costs */}
                        {canShow('cost_breakdown_chart') && (
                            <Section
                                title="System Costs"
                                subtitle="Capital and operational cost breakdown"
                                isExpanded={expandedSections.costs}
                                onToggle={() => toggleSection('costs')}
                            >
                                {loadingCosts ? (
                                    <LoadingSpinner message="Loading cost data..." />
                                ) : (
                                    <CostBreakdownChart data={costs} />
                                )}
                            </Section>
                        )}

                        {/* Emissions */}
                        {canShow('emissions_bar_chart') && (
                            <Section
                                title="CO₂ Emissions"
                                subtitle="Total emissions by carrier type"
                                isExpanded={expandedSections.emissions}
                                onToggle={() => toggleSection('emissions')}
                            >
                                {loadingEmissions ? (
                                    <LoadingSpinner message="Loading emissions data..." />
                                ) : (
                                    <EmissionsChart data={emissions} />
                                )}
                            </Section>
                        )}

                        {/* No Data Available Message */}
                        {!canShow('capacity_bar_chart') &&
                            !canShow('energy_mix_pie') &&
                            !canShow('utilization_chart') &&
                            !canShow('cost_breakdown_chart') &&
                            !canShow('emissions_bar_chart') && (
                                <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-2 border-yellow-200 rounded-2xl p-8 shadow-lg">
                                    <div className="flex items-start gap-4">
                                        <div className="p-3 bg-yellow-200 rounded-xl">
                                            <AlertCircle className="w-6 h-6 text-yellow-700" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-yellow-900 mb-2">
                                                Limited Visualization Available
                                            </h3>
                                            <p className="text-yellow-700 font-medium">
                                                This network file has limited data available for visualization.
                                                This may be because the network has not been solved yet or lacks certain components.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                    </div>
                ) : hasSelection ? null : (
                    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-20">
                        <div className="text-center max-w-md mx-auto">
                            <div className="inline-flex p-4 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl mb-6">
                                <NetworkIcon className="w-16 h-16 text-blue-600" />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-800 mb-3">
                                No Network Selected
                            </h3>
                            <p className="text-slate-500 leading-relaxed">
                                Please select a scenario and network file from above to begin your analysis
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ComprehensiveDashboard;