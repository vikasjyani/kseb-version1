import React, { useState } from 'react';
import { 
    Loader2, 
    Network as NetworkIcon, 
    Activity,
    Zap,
    MapPin,
    Wind,
    Building2,
    Battery,
    BatteryCharging,
    Cable,
    GitBranch,
    Repeat,
    ShieldAlert,
    BarChart3,
    TrendingUp,
    Leaf,
    DollarSign,
    Gauge,
    PieChart,
    Layers
} from 'lucide-react';

// PyPSA Hooks
import usePyPSAAvailability from '../../hooks/usePyPSAAvailability';
import usePyPSAData from '../../hooks/usePyPSAData';

// PyPSA Components
import NetworkMetricsCards from '../../components/pypsa/NetworkMetricsCards';
import CapacityChart from '../../components/pypsa/CapacityChart';
import EnergyMixChart from '../../components/pypsa/EnergyMixChart';
import UtilizationChart from '../../components/pypsa/UtilizationChart';
import CostBreakdownChart from '../../components/pypsa/CostBreakdownChart';
import EmissionsChart from '../../components/pypsa/EmissionsChart';
import ChartCard from '../../components/common/ChartCard';

const networkDataCategories = [
    {
        id: 'overview',
        label: 'Network Overview',
        icon: Layers,
        color: 'blue',
        api: '/pypsa/overview',
        description: 'Key metrics and summary',
    },
    {
        id: 'buses',
        label: 'Buses',
        icon: MapPin,
        color: 'purple',
        api: '/pypsa/buses',
        description: 'Voltage levels & nodal prices',
    },
    {
        id: 'carriers',
        label: 'Carriers',
        icon: Zap,
        color: 'yellow',
        api: '/pypsa/carriers',
        description: 'Energy carriers & emissions',
    },
    {
        id: 'generators',
        label: 'Generators',
        icon: Wind,
        color: 'green',
        api: '/pypsa/generators',
        description: 'Capacity, generation & efficiency',
    },
    {
        id: 'loads',
        label: 'Loads',
        icon: Building2,
        color: 'orange',
        api: '/pypsa/loads',
        description: 'Demand profiles & analysis',
    },
    {
        id: 'storage-units',
        label: 'Storage Units (PHS)',
        icon: Battery,
        color: 'cyan',
        api: '/pypsa/storage-units',
        description: 'Power-based storage (MW)',
    },
    {
        id: 'stores',
        label: 'Stores (Batteries)',
        icon: BatteryCharging,
        color: 'emerald',
        api: '/pypsa/stores',
        description: 'Energy-based storage (MWh)',
    },
    {
        id: 'links',
        label: 'Links',
        icon: GitBranch,
        color: 'indigo',
        api: '/pypsa/links',
        description: 'DC transmission & coupling',
    },
    {
        id: 'lines',
        label: 'Lines',
        icon: Cable,
        color: 'slate',
        api: '/pypsa/lines',
        description: 'AC transmission & utilization',
    },
    {
        id: 'transformers',
        label: 'Transformers',
        icon: Repeat,
        color: 'violet',
        api: '/pypsa/transformers',
        description: 'Capacity & tap ratios',
    },
    {
        id: 'global-constraints',
        label: 'Global Constraints',
        icon: ShieldAlert,
        color: 'red',
        api: '/pypsa/global-constraints',
        description: 'CO₂ limits & shadow prices',
    },
    {
        id: 'capacity-analysis',
        label: 'Capacity Analysis',
        icon: BarChart3,
        color: 'blue',
        api: '/pypsa/total-capacities', // Uses existing endpoint
        description: 'Bar charts & pie charts',
    },
    {
        id: 'capacity-factors',
        label: 'Capacity Factors',
        icon: TrendingUp,
        color: 'green',
        api: '/pypsa/capacity-factors',
        description: 'Utilization by technology',
    },
    {
        id: 'renewable-share',
        label: 'Renewable Energy',
        icon: Leaf,
        color: 'emerald',
        api: '/pypsa/renewable-share',
        description: 'Renewable energy share',
    },
    {
        id: 'system-costs',
        label: 'System Costs',
        icon: DollarSign,
        color: 'rose',
        api: '/pypsa/system-costs',
        description: 'CAPEX/OPEX breakdown',
    },
    {
        id: 'emissions-tracking',
        label: 'Emissions Tracking',
        icon: Activity,
        color: 'orange',
        api: '/pypsa/emissions-tracking',
        description: 'CO₂ emissions & intensity',
    },
    {
        id: 'reserve-margins',
        label: 'Reserve Margins',
        icon: Gauge,
        color: 'purple',
        api: '/pypsa/reserve-margins',
        description: 'System reliability metrics',
    },
    {
        id: 'dispatch-plots',
        label: 'Dispatch Analysis',
        icon: PieChart,
        color: 'indigo',
        api: '/pypsa/dispatch-analysis',
        description: 'Stacked generation plots',
    }
];

const colorClasses = {
    blue: { bg: 'bg-blue-600', hover: 'hover:bg-blue-700', text: 'text-blue-600', bgLight: 'bg-blue-50', border: 'border-blue-200' },
    yellow: { bg: 'bg-yellow-500', hover: 'hover:bg-yellow-600', text: 'text-yellow-600', bgLight: 'bg-yellow-50', border: 'border-yellow-200' },
    green: { bg: 'bg-green-600', hover: 'hover:bg-green-700', text: 'text-green-600', bgLight: 'bg-green-50', border: 'border-green-200' },
    emerald: { bg: 'bg-emerald-600', hover: 'hover:bg-emerald-700', text: 'text-emerald-600', bgLight: 'bg-emerald-50', border: 'border-emerald-200' },
    purple: { bg: 'bg-purple-600', hover: 'hover:bg-purple-700', text: 'text-purple-600', bgLight: 'bg-purple-50', border: 'border-purple-200' },
    rose: { bg: 'bg-rose-600', hover: 'hover:bg-rose-700', text: 'text-rose-600', bgLight: 'bg-rose-50', border: 'border-rose-200' },
    orange: { bg: 'bg-orange-600', hover: 'hover:bg-orange-700', text: 'text-orange-600', bgLight: 'bg-orange-50', border: 'border-orange-200' },
    cyan: { bg: 'bg-cyan-600', hover: 'hover:bg-cyan-700', text: 'text-cyan-600', bgLight: 'bg-cyan-50', border: 'border-cyan-200' },
    indigo: { bg: 'bg-indigo-600', hover: 'hover:bg-indigo-700', text: 'text-indigo-600', bgLight: 'bg-indigo-50', border: 'border-indigo-200' },
    slate: { bg: 'bg-slate-600', hover: 'hover:bg-slate-700', text: 'text-slate-600', bgLight: 'bg-slate-50', border: 'border-slate-200' },
    violet: { bg: 'bg-violet-600', hover: 'hover:bg-violet-700', text: 'text-violet-600', bgLight: 'bg-violet-50', border: 'border-violet-200' },
    red: { bg: 'bg-red-600', hover: 'hover:bg-red-700', text: 'text-red-600', bgLight: 'bg-red-50', border: 'border-red-200' }
};

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

const SingleNetworkView = ({ projectPath, selectedScenario, selectedNetwork }) => {
    const [selectedDataCategory, setSelectedDataCategory] = useState('overview');

    // Get availability information
    const {
        availability,
        loading: loadingAvailability,
        error: availabilityError
    } = usePyPSAAvailability(projectPath, selectedScenario, selectedNetwork);

    const params = projectPath && selectedScenario && selectedNetwork ? {
        projectPath,
        scenarioName: selectedScenario,
        networkFile: selectedNetwork
    } : null;

    // Find the API endpoint for the currently selected category
    const selectedApiEndpoint = networkDataCategories.find(c => c.id === selectedDataCategory)?.api;

    const { data: categoryData, loading: isLoadingCategory } = usePyPSAData(
        selectedApiEndpoint,
        params,
        !!selectedApiEndpoint // Only fetch if an endpoint is defined for the category
    );

    // Handle data category selection
    const handleCategorySelect = (categoryId) => {
        setSelectedDataCategory(categoryId);
    };

    // Loading state
    if (loadingAvailability) {
        return (
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-16">
                <div className="flex flex-col items-center justify-center">
                    <div className="relative mb-6">
                        <Loader2 className="w-16 h-16 text-blue-600 animate-spin" />
                        <div className="absolute inset-0 w-16 h-16 animate-ping text-blue-400 opacity-20">
                            <Loader2 className="w-full h-full" />
                        </div>
                    </div>
                    <p className="text-lg font-semibold text-slate-700">Loading network information...</p>
                    <p className="text-sm text-slate-500 mt-2">This may take a moment</p>
                </div>
            </div>
        );
    }

    // Error state
    if (availabilityError) {
        return (
            <div className="bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-200 rounded-2xl p-8 shadow-lg">
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-red-200 rounded-xl">
                        <Activity className="w-6 h-6 text-red-700" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-red-900 mb-2">Error Loading Network</h3>
                        <p className="text-red-700 font-medium">{availabilityError}</p>
                    </div>
                </div>
            </div>
        );
    }

    // No availability data
    if (!availability) {
        return (
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-16">
                <div className="text-center">
                    <div className="inline-flex p-4 bg-slate-100 rounded-2xl mb-4">
                        <NetworkIcon className="w-16 h-16 text-slate-300" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-700 mb-2">No Network Data</h3>
                    <p className="text-slate-500 font-medium">Unable to load network information.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-1 overflow-hidden">
            {/* Enhanced Sidebar - Network Data Categories */}
            <aside className="w-80 flex-shrink-0 bg-white border-r border-slate-200 shadow-lg flex flex-col">
                {/* Sidebar Header */}
                <div className="p-6 border-b border-slate-200 bg-gradient-to-br from-indigo-50 via-blue-50 to-slate-50">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-indigo-100 rounded-lg">
                            <NetworkIcon className="w-5 h-5 text-indigo-600" />
                        </div>
                        <h2 className="text-lg font-bold text-slate-800">Network Analysis</h2>
                    </div>
                    
                    <div className="space-y-2">
                        <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                            Selected Network
                        </div>
                        <div className="p-3 bg-white rounded-xl border-2 border-indigo-200 shadow-sm">
                            <div className="font-bold text-slate-800 text-sm mb-1">
                                {selectedScenario}
                            </div>
                            <div className="text-xs text-slate-500 truncate">
                                {selectedNetwork}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Data Categories List */}
                <div className="flex-grow overflow-y-auto p-4">
                    <div className="space-y-1">
                        {networkDataCategories.map(category => {
                            const isSelected = selectedDataCategory === category.id;
                            const colors = colorClasses[category.color];
                            const Icon = category.icon;
                            
                            return (
                                <button
                                    key={category.id}
                                    onClick={() => handleCategorySelect(category.id)}
                                    className={`
                                        w-full text-left px-3 py-2.5 rounded-lg font-medium transition-all duration-200
                                        ${isSelected
                                            ? `${colors.bg} text-white shadow-md scale-[1.02]`
                                            : `bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 hover:border-slate-300`
                                        }
                                    `}
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className={`
                                            p-1.5 rounded-md transition-all flex-shrink-0
                                            ${isSelected ? 'bg-white/20' : colors.bgLight}
                                        `}>
                                            <Icon 
                                                size={16} 
                                                className={isSelected ? 'text-white' : colors.text}
                                            />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-semibold truncate">
                                                {category.label}
                                            </div>
                                            {!isSelected && (
                                                <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                                                    {category.description}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 p-6 overflow-y-auto bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
                <div className="max-w-7xl mx-auto">
                    {(() => {
                        const category = networkDataCategories.find(c => c.id === selectedDataCategory);
                        if (!category) return null;

                        return (
                            <ChartCard
                                title={category.label}
                                description={category.description}
                                icon={category.icon}
                                color={category.color}
                                isLoading={isLoadingCategory}
                            >
                                {selectedDataCategory === 'overview' && <NetworkMetricsCards availability={availability} />}
                                {selectedDataCategory === 'capacity-analysis' && <CapacityChart data={categoryData} />}
                                {selectedDataCategory === 'capacity-factors' && <UtilizationChart data={categoryData} />}
                                {selectedDataCategory === 'system-costs' && <CostBreakdownChart data={categoryData} />}
                                {selectedDataCategory === 'emissions-tracking' && <EmissionsChart data={categoryData} />}
                                {/* Add other charts here as they are created */}
                            </ChartCard>
                        );
                    })()}
                </div>
            </main>
        </div>
    );
};

export default SingleNetworkView;
