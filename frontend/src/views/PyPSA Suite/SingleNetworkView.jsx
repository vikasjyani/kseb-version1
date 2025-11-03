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

/**
 * Network data categories with their respective API endpoints and expected data structures
 */
const networkDataCategories = [
    {
        id: 'overview',
        label: 'Network Overview',
        icon: Layers,
        color: 'blue',
        description: 'Key metrics and summary',
        // API: GET /pypsa/overview
        // Expected Response: {
        //   success: true,
        //   network_name: string,
        //   num_buses: number,
        //   num_generators: number,
        //   num_loads: number,
        //   num_storage_units: number,
        //   num_stores: number,
        //   num_lines: number,
        //   num_links: number,
        //   total_capacity_mw: number,
        //   total_generation_mwh: number,
        //   peak_load_mw: number
        // }
    },
    {
        id: 'buses',
        label: 'Buses',
        icon: MapPin,
        color: 'purple',
        description: 'Voltage levels & nodal prices',
        // API: GET /pypsa/buses
        // Expected Response: {
        //   success: true,
        //   buses: [
        //     {
        //       bus_name: string,
        //       voltage_level: number,  // kV
        //       zone: string,
        //       carrier: string,
        //       x_coord: number,
        //       y_coord: number,
        //       marginal_price: number,  // EUR/MWh per timestep
        //       avg_price: number  // EUR/MWh
        //     }
        //   ],
        //   voltage_levels: [110, 220, 380],  // Unique voltage levels
        //   zones: ['north', 'south', 'east', 'west'],
        //   price_statistics: {
        //     min: number,
        //     max: number,
        //     avg: number,
        //     std: number
        //   }
        // }
    },
    {
        id: 'carriers',
        label: 'Carriers',
        icon: Zap,
        color: 'yellow',
        description: 'Energy carriers & emissions',
        // API: GET /pypsa/carriers
        // Expected Response: {
        //   success: true,
        //   carriers: [
        //     {
        //       carrier_name: string,
        //       co2_emissions: number,  // t/MWh
        //       color: string,  // Hex color code
        //       nice_name: string,
        //       total_capacity: number,  // MW
        //       total_generation: number,  // MWh
        //       share_percentage: number,  // %
        //       num_generators: number
        //     }
        //   ],
        //   total_emissions: number,  // tCO2
        //   emission_intensity: number  // tCO2/MWh
        // }
    },
    {
        id: 'generators',
        label: 'Generators',
        icon: Wind,
        color: 'green',
        description: 'Capacity, generation & efficiency',
        // API: GET /pypsa/generators
        // Expected Response: {
        //   success: true,
        //   generators: [
        //     {
        //       generator_name: string,
        //       bus: string,
        //       carrier: string,
        //       p_nom: number,  // Nominal capacity (MW)
        //       p_nom_opt: number,  // Optimized capacity (MW)
        //       p_nom_extendable: boolean,
        //       capital_cost: number,  // EUR/MW
        //       marginal_cost: number,  // EUR/MWh
        //       efficiency: number,  // %
        //       total_generation: number,  // MWh
        //       capacity_factor: number,  // %
        //       curtailment: number,  // MWh
        //       revenue: number,  // EUR
        //       opex: number,  // EUR
        //       capex: number  // EUR
        //     }
        //   ],
        //   by_carrier: {
        //     [carrier: string]: {
        //       total_capacity: number,
        //       total_generation: number,
        //       avg_capacity_factor: number
        //     }
        //   }
        // }
    },
    {
        id: 'loads',
        label: 'Loads',
        icon: Building2,
        color: 'orange',
        description: 'Demand profiles & analysis',
        // API: GET /pypsa/loads
        // Expected Response: {
        //   success: true,
        //   loads: [
        //     {
        //       load_name: string,
        //       bus: string,
        //       carrier: string,
        //       total_demand: number,  // MWh
        //       peak_demand: number,  // MW
        //       avg_demand: number,  // MW
        //       load_factor: number,  // %
        //       time_series: [
        //         {
        //           timestamp: string,
        //           power_mw: number
        //         }
        //       ]
        //     }
        //   ],
        //   total_demand: number,  // MWh
        //   peak_demand: number,  // MW
        //   load_duration_curve: [
        //     {
        //       hour: number,
        //       demand_mw: number
        //     }
        //   ],
        //   demand_by_carrier: {
        //     [carrier: string]: number  // MWh
        //   }
        // }
    },
    {
        id: 'storage-units',
        label: 'Storage Units (PHS)',
        icon: Battery,
        color: 'cyan',
        description: 'Power-based storage (MW)',
        // API: GET /pypsa/storage-units
        // Expected Response: {
        //   success: true,
        //   storage_units: [
        //     {
        //       storage_unit_name: string,
        //       bus: string,
        //       carrier: string,
        //       p_nom: number,  // Power capacity (MW)
        //       p_nom_opt: number,  // Optimized power (MW)
        //       max_hours: number,  // Energy/Power ratio (hours)
        //       efficiency_dispatch: number,  // %
        //       efficiency_store: number,  // %
        //       cyclic_state_of_charge: boolean,
        //       state_of_charge_initial: number,  // MWh
        //       capital_cost: number,  // EUR/MW
        //       dispatch_total: number,  // MWh dispatched
        //       store_total: number,  // MWh stored
        //       cycles: number,
        //       revenue: number  // EUR
        //     }
        //   ],
        //   total_power_capacity: number,  // MW
        //   total_energy_capacity: number,  // MWh
        //   avg_efficiency: number  // %
        // }
    },
    {
        id: 'stores',
        label: 'Stores (Batteries)',
        icon: BatteryCharging,
        color: 'emerald',
        description: 'Energy-based storage (MWh)',
        // API: GET /pypsa/stores
        // Expected Response: {
        //   success: true,
        //   stores: [
        //     {
        //       store_name: string,
        //       bus: string,
        //       carrier: string,
        //       e_nom: number,  // Energy capacity (MWh)
        //       e_nom_opt: number,  // Optimized energy (MWh)
        //       e_cyclic: boolean,
        //       e_initial: number,  // MWh
        //       capital_cost: number,  // EUR/MWh
        //       standing_loss: number,  // per hour
        //       charging_total: number,  // MWh
        //       discharging_total: number,  // MWh
        //       state_of_charge: [
        //         {
        //           timestamp: string,
        //           soc_mwh: number
        //         }
        //       ],
        //       cycles: number,
        //       depth_of_discharge: number  // %
        //     }
        //   ],
        //   total_energy_capacity: number,  // MWh
        //   total_cycles: number
        // }
    },
    {
        id: 'links',
        label: 'Links',
        icon: GitBranch,
        color: 'indigo',
        description: 'DC transmission & coupling',
        // API: GET /pypsa/links
        // Expected Response: {
        //   success: true,
        //   links: [
        //     {
        //       link_name: string,
        //       bus0: string,
        //       bus1: string,
        //       carrier: string,
        //       p_nom: number,  // Capacity (MW)
        //       p_nom_opt: number,  // Optimized capacity (MW)
        //       length: number,  // km
        //       efficiency: number,  // %
        //       capital_cost: number,  // EUR/MW
        //       p_flow: number,  // Total flow (MWh)
        //       utilization: number,  // %
        //       congestion_hours: number,
        //       reversible: boolean
        //     }
        //   ],
        //   total_capacity: number,  // MW
        //   avg_utilization: number,  // %
        //   by_carrier: {
        //     [carrier: string]: {
        //       capacity: number,
        //       flow: number
        //     }
        //   }
        // }
    },
    {
        id: 'lines',
        label: 'Lines',
        icon: Cable,
        color: 'slate',
        description: 'AC transmission & utilization',
        // API: GET /pypsa/lines
        // Expected Response: {
        //   success: true,
        //   lines: [
        //     {
        //       line_name: string,
        //       bus0: string,
        //       bus1: string,
        //       type: string,
        //       s_nom: number,  // Capacity (MVA)
        //       s_nom_opt: number,  // Optimized capacity (MVA)
        //       length: number,  // km
        //       r: number,  // Resistance (ohm/km)
        //       x: number,  // Reactance (ohm/km)
        //       capital_cost: number,  // EUR/MVA
        //       p_flow: number,  // Active power flow (MWh)
        //       utilization: number,  // %
        //       congestion_hours: number,
        //       losses: number  // MWh
        //     }
        //   ],
        //   total_capacity: number,  // MVA
        //   total_losses: number,  // MWh
        //   avg_utilization: number,  // %
        //   congested_lines: number
        // }
    },
    {
        id: 'transformers',
        label: 'Transformers',
        icon: Repeat,
        color: 'violet',
        description: 'Capacity & tap ratios',
        // API: GET /pypsa/transformers
        // Expected Response: {
        //   success: true,
        //   transformers: [
        //     {
        //       transformer_name: string,
        //       bus0: string,
        //       bus1: string,
        //       type: string,
        //       s_nom: number,  // Capacity (MVA)
        //       tap_ratio: number,
        //       phase_shift: number,  // degrees
        //       capital_cost: number,  // EUR/MVA
        //       p_flow: number,  // MWh
        //       utilization: number,  // %
        //       losses: number  // MWh
        //     }
        //   ],
        //   total_capacity: number,  // MVA
        //   total_losses: number  // MWh
        // }
    },
    {
        id: 'global-constraints',
        label: 'Global Constraints',
        icon: ShieldAlert,
        color: 'red',
        description: 'CO₂ limits & shadow prices',
        // API: GET /pypsa/global-constraints
        // Expected Response: {
        //   success: true,
        //   constraints: [
        //     {
        //       constraint_name: string,
        //       type: string,  // 'CO2Limit', 'primary_energy', etc.
        //       carrier_attribute: string,
        //       sense: string,  // '<=', '>=', '=='
        //       constant: number,
        //       actual_value: number,
        //       shadow_price: number,  // EUR/unit
        //       slack: number,
        //       binding: boolean
        //     }
        //   ],
        //   co2_limit: number,  // tCO2
        //   co2_emissions: number,  // tCO2
        //   co2_shadow_price: number  // EUR/tCO2
        // }
    },
    {
        id: 'capacity-analysis',
        label: 'Capacity Analysis',
        icon: BarChart3,
        color: 'blue',
        description: 'Bar charts & pie charts',
        // API: GET /pypsa/capacity-analysis
        // This uses existing endpoints:
        // - /pypsa/total-capacities
        // - /pypsa/capacity-by-carrier
        // Plus additional visualizations
    },
    {
        id: 'capacity-factors',
        label: 'Capacity Factors',
        icon: TrendingUp,
        color: 'green',
        description: 'Utilization by technology',
        // API: GET /pypsa/capacity-factors
        // Expected Response: {
        //   success: true,
        //   capacity_factors: [
        //     {
        //       carrier: string,
        //       technology: string,
        //       capacity_factor: number,  // %
        //       total_capacity: number,  // MW
        //       actual_generation: number,  // MWh
        //       potential_generation: number  // MWh
        //     }
        //   ],
        //   by_carrier: {
        //     [carrier: string]: number  // Average capacity factor
        //   }
        // }
    },
    {
        id: 'renewable-share',
        label: 'Renewable Energy',
        icon: Leaf,
        color: 'emerald',
        description: 'Renewable energy share',
        // API: GET /pypsa/renewable-share
        // Expected Response: {
        //   success: true,
        //   renewable_generation: number,  // MWh
        //   total_generation: number,  // MWh
        //   renewable_share: number,  // %
        //   by_technology: [
        //     {
        //       technology: string,
        //       generation: number,  // MWh
        //       share: number  // %
        //     }
        //   ],
        //   renewable_carriers: ['wind', 'solar', 'hydro'],
        //   fossil_carriers: ['gas', 'coal']
        // }
    },
    {
        id: 'system-costs',
        label: 'System Costs',
        icon: DollarSign,
        color: 'rose',
        description: 'CAPEX/OPEX breakdown',
        // API: GET /pypsa/system-costs
        // Expected Response: {
        //   success: true,
        //   total_cost: number,  // EUR
        //   capex_total: number,  // EUR
        //   opex_total: number,  // EUR
        //   by_component: [
        //     {
        //       component_type: string,  // 'Generator', 'Line', 'StorageUnit'
        //       carrier: string,
        //       capex: number,  // EUR
        //       opex: number,  // EUR
        //       total: number  // EUR
        //     }
        //   ],
        //   levelized_cost: number,  // EUR/MWh
        //   annual_cost: number  // EUR/year
        // }
    },
    {
        id: 'emissions-tracking',
        label: 'Emissions Tracking',
        icon: Activity,
        color: 'orange',
        description: 'CO₂ emissions & intensity',
        // API: GET /pypsa/emissions-tracking
        // Expected Response: {
        //   success: true,
        //   total_emissions: number,  // tCO2
        //   emission_intensity: number,  // tCO2/MWh
        //   by_carrier: [
        //     {
        //       carrier: string,
        //       emissions: number,  // tCO2
        //       generation: number,  // MWh
        //       intensity: number  // tCO2/MWh
        //     }
        //   ],
        //   time_series: [
        //     {
        //       timestamp: string,
        //       emissions_tco2: number
        //     }
        //   ]
        // }
    },
    {
        id: 'reserve-margins',
        label: 'Reserve Margins',
        icon: Gauge,
        color: 'purple',
        description: 'System reliability metrics',
        // API: GET /pypsa/reserve-margins
        // Expected Response: {
        //   success: true,
        //   total_capacity: number,  // MW
        //   peak_demand: number,  // MW
        //   reserve_margin: number,  // %
        //   by_carrier: [
        //     {
        //       carrier: string,
        //       capacity: number,  // MW
        //       margin: number  // %
        //     }
        //   ],
        //   firm_capacity: number,  // MW (dispatchable)
        //   variable_capacity: number  // MW (VRE)
        // }
    },
    {
        id: 'dispatch-plots',
        label: 'Dispatch Analysis',
        icon: PieChart,
        color: 'indigo',
        description: 'Stacked generation plots',
        // API: GET /pypsa/dispatch-analysis
        // Expected Response: {
        //   success: true,
        //   time_series: [
        //     {
        //       timestamp: string,
        //       generation_by_carrier: {
        //         [carrier: string]: number  // MW
        //       },
        //       storage_charge: number,  // MW (negative)
        //       storage_discharge: number,  // MW (positive)
        //       load: number  // MW
        //     }
        //   ],
        //   carriers: ['wind', 'solar', 'gas', 'storage'],
        //   duration_hours: number
        // }
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
    const [categoryData, setCategoryData] = useState(null);
    const [loadingCategoryData, setLoadingCategoryData] = useState(false);

    // Get availability information
    const {
        availability,
        loading: loadingAvailability,
        error: availabilityError,
        canShow,
        canAnalyze
    } = usePyPSAAvailability(projectPath, selectedScenario, selectedNetwork);

    // Fetch data for existing categories (will be reorganized)
    const params = projectPath && selectedScenario && selectedNetwork ? {
        projectPath,
        scenarioName: selectedScenario,
        networkFile: selectedNetwork
    } : null;

    const { data: capacities, loading: loadingCapacities } = usePyPSAData(
        '/pypsa/total-capacities',
        params,
        canAnalyze('total_capacities') && selectedDataCategory === 'capacity-analysis'
    );

    const { data: energyMix, loading: loadingEnergyMix } = usePyPSAData(
        '/pypsa/energy-mix',
        params,
        canAnalyze('energy_mix') && selectedDataCategory === 'capacity-analysis'
    );

    const { data: utilization, loading: loadingUtilization } = usePyPSAData(
        '/pypsa/utilization',
        params,
        canAnalyze('utilization') && selectedDataCategory === 'capacity-factors'
    );

    const { data: costs, loading: loadingCosts } = usePyPSAData(
        '/pypsa/costs',
        params,
        canAnalyze('system_costs') && selectedDataCategory === 'system-costs'
    );

    const { data: emissions, loading: loadingEmissions } = usePyPSAData(
        '/pypsa/emissions',
        params,
        canAnalyze('emissions') && selectedDataCategory === 'emissions-tracking'
    );

    // Handle data category selection
    const handleCategorySelect = (categoryId) => {
        setSelectedDataCategory(categoryId);
        setCategoryData(null);
        // Here you would fetch data based on the category
        // For now, we'll handle existing categories with the hooks above
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
                    {selectedDataCategory === 'overview' && (
                        <div className="space-y-6">
                            {/* Network Overview Header */}
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="p-3 bg-blue-50 rounded-xl">
                                        <Layers className="w-7 h-7 text-blue-600" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-slate-800">Network Overview</h2>
                                        <p className="text-sm text-slate-500 mt-1">Key metrics and summary statistics</p>
                                    </div>
                                </div>
                            </div>

                            {/* Network Metrics Cards */}
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                                <NetworkMetricsCards availability={availability} />
                            </div>
                        </div>
                    )}

                    {selectedDataCategory === 'capacity-analysis' && (
                        <div className="space-y-6">
                            {/* Header */}
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-blue-50 rounded-xl">
                                        <BarChart3 className="w-7 h-7 text-blue-600" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-slate-800">Capacity Analysis</h2>
                                        <p className="text-sm text-slate-500 mt-1">Installed capacity and generation mix</p>
                                    </div>
                                </div>
                            </div>

                            {/* Capacity Chart */}
                            {loadingCapacities ? (
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12">
                                    <LoadingSpinner message="Loading capacity data..." />
                                </div>
                            ) : (
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                                    <h3 className="text-lg font-bold text-slate-800 mb-4">Installed Capacity by Technology</h3>
                                    <CapacityChart data={capacities} />
                                </div>
                            )}

                            {/* Energy Mix Chart */}
                            {loadingEnergyMix ? (
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12">
                                    <LoadingSpinner message="Loading energy mix data..." />
                                </div>
                            ) : (
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                                    <h3 className="text-lg font-bold text-slate-800 mb-4">Energy Generation Mix</h3>
                                    <EnergyMixChart data={energyMix} />
                                </div>
                            )}
                        </div>
                    )}

                    {selectedDataCategory === 'capacity-factors' && (
                        <div className="space-y-6">
                            {/* Header */}
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-green-50 rounded-xl">
                                        <TrendingUp className="w-7 h-7 text-green-600" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-slate-800">Capacity Factors</h2>
                                        <p className="text-sm text-slate-500 mt-1">Utilization rates by technology</p>
                                    </div>
                                </div>
                            </div>

                            {/* Utilization Chart */}
                            {loadingUtilization ? (
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12">
                                    <LoadingSpinner message="Loading utilization data..." />
                                </div>
                            ) : (
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                                    <UtilizationChart data={utilization} />
                                </div>
                            )}
                        </div>
                    )}

                    {selectedDataCategory === 'system-costs' && (
                        <div className="space-y-6">
                            {/* Header */}
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-rose-50 rounded-xl">
                                        <DollarSign className="w-7 h-7 text-rose-600" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-slate-800">System Costs</h2>
                                        <p className="text-sm text-slate-500 mt-1">CAPEX and OPEX breakdown</p>
                                    </div>
                                </div>
                            </div>

                            {/* Cost Chart */}
                            {loadingCosts ? (
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12">
                                    <LoadingSpinner message="Loading cost data..." />
                                </div>
                            ) : (
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                                    <CostBreakdownChart data={costs} />
                                </div>
                            )}
                        </div>
                    )}

                    {selectedDataCategory === 'emissions-tracking' && (
                        <div className="space-y-6">
                            {/* Header */}
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-orange-50 rounded-xl">
                                        <Activity className="w-7 h-7 text-orange-600" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-slate-800">Emissions Tracking</h2>
                                        <p className="text-sm text-slate-500 mt-1">CO₂ emissions and intensity</p>
                                    </div>
                                </div>
                            </div>

                            {/* Emissions Chart */}
                            {loadingEmissions ? (
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12">
                                    <LoadingSpinner message="Loading emissions data..." />
                                </div>
                            ) : (
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                                    <EmissionsChart data={emissions} />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Placeholder for other categories */}
                    {!['overview', 'capacity-analysis', 'capacity-factors', 'system-costs', 'emissions-tracking'].includes(selectedDataCategory) && (
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-16">
                            <div className="text-center max-w-md mx-auto">
                                <div className="inline-flex p-4 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl mb-4">
                                    {(() => {
                                        const category = networkDataCategories.find(c => c.id === selectedDataCategory);
                                        const Icon = category?.icon || NetworkIcon;
                                        const colors = colorClasses[category?.color || 'blue'];
                                        return <Icon className={`w-16 h-16 ${colors.text}`} />;
                                    })()}
                                </div>
                                <h3 className="text-xl font-bold text-slate-800 mb-2">
                                    {networkDataCategories.find(c => c.id === selectedDataCategory)?.label}
                                </h3>
                                <p className="text-slate-500 mb-4">
                                    {networkDataCategories.find(c => c.id === selectedDataCategory)?.description}
                                </p>
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
                                    <p className="text-sm font-semibold text-blue-900 mb-2">Backend API Required</p>
                                    <p className="text-xs text-blue-700">
                                        This view requires backend implementation. See the component source code for detailed API specifications and expected response formats.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default SingleNetworkView;