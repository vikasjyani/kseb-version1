import React, { useState, useCallback } from 'react';
import axios from 'axios';
import { 
    Loader2, 
    Network as NetworkIcon, 
    TrendingUp, 
    Zap, 
    BarChart3, 
    Leaf, 
    Battery, 
    DollarSign,
    Calendar,
    Sparkles,
    Cable,
    Building2,
    Scissors,
    MapPin,
    ShieldAlert,
    Globe,
    Repeat,
    Activity,
    Target,
    GitBranch,
    Fuel,
    Gauge,
    PieChart,
    Wind,
    Users,
    TrendingDown
} from 'lucide-react';

// Multi-Year Chart Components
import CapacityEvolutionChart from '../../components/pypsa/CapacityEvolutionChart';
import EnergyMixEvolutionChart from '../../components/pypsa/EnergyMixEvolutionChart';
import CUFEvolutionChart from '../../components/pypsa/CUFEvolutionChart';
import EmissionsEvolutionChart from '../../components/pypsa/EmissionsEvolutionChart';
import StorageEvolutionChart from '../../components/pypsa/StorageEvolutionChart';
import CostEvolutionChart from '../../components/pypsa/CostEvolutionChart';

/**
 * Multi-Year Analysis Categories
 * Comprehensive year-on-year trend analysis for long-term energy system planning
 */
const analysisTypes = [
    // ==================== EXISTING CATEGORIES ====================
    { 
        id: 'capacity-evolution', 
        label: 'Capacity Evolution', 
        icon: BarChart3,
        color: 'blue',
        description: 'Track installed capacity trends',
        category: 'Generation',
        // API: GET /project/pypsa/multi-year/capacity-evolution
        // Expected Response: {
        //   success: true,
        //   years: [2025, 2030, 2035, 2040, 2045, 2050],
        //   capacity_by_carrier: {
        //     wind: [25000, 35000, 45000, 55000, 65000, 75000],
        //     solar: [15000, 25000, 35000, 45000, 55000, 65000],
        //     gas: [30000, 28000, 25000, 20000, 15000, 10000]
        //   },
        //   total_capacity: [85000, 105000, 125000, 145000, 165000, 185000],
        //   growth_rates: {
        //     wind: [0, 40.0, 28.6, 22.2, 18.2, 15.4],
        //     solar: [0, 66.7, 40.0, 28.6, 22.2, 18.2]
        //   }
        // }
    },
    { 
        id: 'energy-mix-evolution', 
        label: 'Energy Mix Evolution', 
        icon: Zap,
        color: 'yellow',
        description: 'Monitor energy generation mix',
        category: 'Generation',
        // API: GET /project/pypsa/multi-year/energy-mix-evolution
        // Expected Response: {
        //   success: true,
        //   years: [2025, 2030, 2035, 2040, 2045, 2050],
        //   generation_by_carrier: {
        //     wind: [85000, 125000, 175000, 225000, 275000, 325000],
        //     solar: [45000, 85000, 135000, 185000, 235000, 285000],
        //     gas: [150000, 125000, 95000, 65000, 35000, 15000]
        //   },
        //   total_generation: [350000, 425000, 505000, 585000, 665000, 745000],
        //   share_by_carrier: {
        //     wind: [24.3, 29.4, 34.7, 38.5, 41.4, 43.6],
        //     solar: [12.9, 20.0, 26.7, 31.6, 35.3, 38.3]
        //   }
        // }
    },
    { 
        id: 'cuf-evolution', 
        label: 'CUF Evolution', 
        icon: TrendingUp,
        color: 'green',
        description: 'Analyze capacity utilization factors',
        category: 'Performance',
        // API: GET /project/pypsa/multi-year/cuf-evolution
        // Expected Response: {
        //   success: true,
        //   years: [2025, 2030, 2035, 2040, 2045, 2050],
        //   cuf_by_carrier: {
        //     wind: [35.5, 36.2, 37.0, 37.5, 38.0, 38.5],
        //     solar: [15.2, 15.8, 16.2, 16.5, 16.8, 17.0],
        //     gas: [45.0, 42.0, 38.0, 32.5, 25.0, 15.0]
        //   },
        //   avg_cuf: [35.2, 35.8, 36.5, 37.0, 37.5, 38.0]
        // }
    },
    { 
        id: 'emissions-evolution', 
        label: 'Emissions Evolution', 
        icon: Leaf,
        color: 'emerald',
        description: 'Track CO₂ emissions over time',
        category: 'Environment',
        // API: GET /project/pypsa/multi-year/emissions-evolution
        // Expected Response: {
        //   success: true,
        //   years: [2025, 2030, 2035, 2040, 2045, 2050],
        //   total_emissions: [67500000, 56250000, 42750000, 29250000, 15750000, 6750000],
        //   emissions_by_carrier: {
        //     gas: [67500000, 56250000, 42750000, 29250000, 15750000, 6750000],
        //     coal: [0, 0, 0, 0, 0, 0]
        //   },
        //   emission_intensity: [0.193, 0.132, 0.085, 0.050, 0.024, 0.009],
        //   emission_reduction: [0, 16.7, 36.7, 56.7, 76.7, 90.0]
        // }
    },
    { 
        id: 'storage-evolution', 
        label: 'Storage Evolution', 
        icon: Battery,
        color: 'purple',
        description: 'Monitor storage capacity trends',
        category: 'Storage',
        // API: GET /project/pypsa/multi-year/storage-evolution
        // Expected Response: {
        //   success: true,
        //   years: [2025, 2030, 2035, 2040, 2045, 2050],
        //   storage_power_capacity: {
        //     PHS: [15000, 17500, 20000, 22500, 25000, 27500],
        //     battery: [5000, 12500, 25000, 40000, 60000, 85000]
        //   },
        //   storage_energy_capacity: {
        //     PHS: [90000, 105000, 120000, 135000, 150000, 165000],
        //     battery: [5000, 12500, 25000, 40000, 60000, 85000]
        //   },
        //   total_storage: [110000, 135000, 170000, 215000, 270000, 335000]
        // }
    },
    { 
        id: 'cost-evolution', 
        label: 'Cost Evolution', 
        icon: DollarSign,
        color: 'rose',
        description: 'Analyze cost trends',
        category: 'Economics',
        // API: GET /project/pypsa/multi-year/cost-evolution
        // Expected Response: {
        //   success: true,
        //   years: [2025, 2030, 2035, 2040, 2045, 2050],
        //   total_system_cost: [1250000000, 1375000000, 1450000000, 1500000000, 1525000000, 1550000000],
        //   capex: [850000000, 950000000, 1025000000, 1075000000, 1100000000, 1125000000],
        //   opex: [400000000, 425000000, 425000000, 425000000, 425000000, 425000000],
        //   levelized_cost: [2.56, 2.35, 2.18, 2.05, 1.95, 1.88]
        // }
    },

    // ==================== NEW CATEGORIES ====================
    
    // TRANSMISSION & GRID
    { 
        id: 'transmission-evolution', 
        label: 'Transmission Evolution', 
        icon: Cable,
        color: 'indigo',
        description: 'Grid expansion and capacity',
        category: 'Transmission',
        // API: GET /project/pypsa/multi-year/transmission-evolution
        // Expected Response: {
        //   success: true,
        //   years: [2025, 2030, 2035, 2040, 2045, 2050],
        //   ac_lines_capacity: [285000, 325000, 365000, 405000, 445000, 485000],
        //   dc_links_capacity: [45000, 65000, 85000, 105000, 125000, 145000],
        //   total_transmission: [330000, 390000, 450000, 510000, 570000, 630000],
        //   new_lines_built: [0, 15, 22, 28, 35, 40],
        //   avg_utilization: [55.2, 58.5, 61.8, 64.2, 66.5, 68.8],
        //   congestion_hours: [850, 725, 625, 550, 475, 425],
        //   by_voltage_level: {
        //     '380kV': [180000, 210000, 240000, 270000, 300000, 330000],
        //     '220kV': [105000, 115000, 125000, 135000, 145000, 155000]
        //   }
        // }
    },
    { 
        id: 'interconnection-evolution', 
        label: 'Interconnection Growth', 
        icon: GitBranch,
        color: 'cyan',
        description: 'Cross-border capacity evolution',
        category: 'Transmission',
        // API: GET /project/pypsa/multi-year/interconnection-evolution
        // Expected Response: {
        //   success: true,
        //   years: [2025, 2030, 2035, 2040, 2045, 2050],
        //   total_interconnection: [25000, 35000, 45000, 55000, 65000, 75000],
        //   by_corridor: {
        //     'DE-FR': [5000, 7500, 10000, 12500, 15000, 17500],
        //     'DE-PL': [4000, 6000, 8000, 10000, 12000, 14000],
        //     'FR-UK': [3000, 5000, 7000, 9000, 11000, 13000]
        //   },
        //   trade_volume: [87500, 125000, 162500, 200000, 237500, 275000],
        //   interconnection_ratio: [7.6, 9.0, 10.4, 11.8, 13.2, 14.6],
        //   net_exports: {
        //     DE: [15000, 22500, 30000, 37500, 45000, 52500],
        //     FR: [-8000, -12000, -16000, -20000, -24000, -28000]
        //   }
        // }
    },
    { 
        id: 'grid-losses-evolution', 
        label: 'Grid Losses Evolution', 
        icon: TrendingDown,
        color: 'slate',
        description: 'Transmission efficiency improvements',
        category: 'Transmission',
        // API: GET /project/pypsa/multi-year/grid-losses-evolution
        // Expected Response: {
        //   success: true,
        //   years: [2025, 2030, 2035, 2040, 2045, 2050],
        //   total_losses: [14250, 15875, 17375, 18750, 19875, 20875],
        //   losses_percentage: [4.1, 3.7, 3.4, 3.2, 3.0, 2.8],
        //   by_component: {
        //     lines: [11250, 12500, 13625, 14625, 15500, 16250],
        //     transformers: [2625, 2875, 3125, 3375, 3625, 3875],
        //     links: [375, 500, 625, 750, 750, 750]
        //   }
        // }
    },

    // DEMAND & LOAD
    { 
        id: 'load-growth', 
        label: 'Load Growth', 
        icon: Building2,
        color: 'orange',
        description: 'Demand evolution across years',
        category: 'Demand',
        // API: GET /project/pypsa/multi-year/load-growth
        // Expected Response: {
        //   success: true,
        //   years: [2025, 2030, 2035, 2040, 2045, 2050],
        //   total_demand: [350000, 425000, 505000, 585000, 665000, 745000],
        //   peak_demand: [95000, 108000, 121000, 134000, 147000, 160000],
        //   growth_rate: [0, 21.4, 18.8, 15.8, 13.7, 12.0],
        //   by_sector: {
        //     residential: [105000, 127500, 151500, 175500, 199500, 223500],
        //     commercial: [87500, 106250, 126250, 146250, 166250, 186250],
        //     industrial: [140000, 170000, 202000, 234000, 266000, 298000],
        //     transport: [17500, 21250, 25250, 29250, 33250, 37250]
        //   },
        //   electrification_rate: [35.0, 42.5, 50.5, 58.5, 66.5, 74.5]
        // }
    },
    { 
        id: 'peak-demand-evolution', 
        label: 'Peak Demand Evolution', 
        icon: TrendingUp,
        color: 'red',
        description: 'How peak loads change over time',
        category: 'Demand',
        // API: GET /project/pypsa/multi-year/peak-demand-evolution
        // Expected Response: {
        //   success: true,
        //   years: [2025, 2030, 2035, 2040, 2045, 2050],
        //   annual_peak: [95000, 108000, 121000, 134000, 147000, 160000],
        //   seasonal_peaks: {
        //     winter: [95000, 108000, 121000, 134000, 147000, 160000],
        //     summer: [82000, 94000, 106000, 118000, 130000, 142000]
        //   },
        //   peak_hours: [18, 18, 19, 19, 19, 20],
        //   load_factor: [79.7, 80.2, 80.7, 81.2, 81.7, 82.2]
        // }
    },

    // RENEWABLE & TECHNOLOGY
    { 
        id: 'renewable-penetration', 
        label: 'Renewable Penetration', 
        icon: Wind,
        color: 'emerald',
        description: 'Growth of renewable share',
        category: 'Renewables',
        // API: GET /project/pypsa/multi-year/renewable-penetration
        // Expected Response: {
        //   success: true,
        //   years: [2025, 2030, 2035, 2040, 2045, 2050],
        //   renewable_share: [37.1, 49.4, 61.5, 73.0, 83.6, 92.0],
        //   by_technology: {
        //     wind: [24.3, 29.4, 34.7, 38.5, 41.4, 43.6],
        //     solar: [12.9, 20.0, 26.7, 31.6, 35.3, 38.3],
        //     hydro: [0, 0, 0, 2.9, 6.9, 10.1]
        //   },
        //   fossil_share: [62.9, 50.6, 38.5, 27.0, 16.4, 8.0],
        //   vRE_share: [37.1, 49.4, 61.5, 70.1, 76.7, 81.9]
        // }
    },
    { 
        id: 'technology-mix-evolution', 
        label: 'Technology Mix Evolution', 
        icon: Repeat,
        color: 'violet',
        description: 'How technology portfolio changes',
        category: 'Renewables',
        // API: GET /project/pypsa/multi-year/technology-mix-evolution
        // Expected Response: {
        //   success: true,
        //   years: [2025, 2030, 2035, 2040, 2045, 2050],
        //   capacity_share: {
        //     'wind-onshore': [20.0, 22.9, 25.6, 28.0, 30.3, 32.4],
        //     'wind-offshore': [9.4, 11.4, 13.6, 15.5, 17.3, 19.0],
        //     'solar-utility': [12.9, 17.1, 21.6, 25.5, 29.1, 32.4],
        //     'solar-rooftop': [4.7, 6.7, 8.8, 10.3, 11.5, 12.7],
        //     'gas-CCGT': [28.2, 24.8, 20.0, 13.8, 9.1, 5.4],
        //     'battery': [5.9, 11.9, 20.0, 27.6, 36.4, 45.9]
        //   }
        // }
    },
    { 
        id: 'curtailment-evolution', 
        label: 'Curtailment Evolution', 
        icon: Scissors,
        color: 'red',
        description: 'How curtailment changes over time',
        category: 'Renewables',
        // API: GET /project/pypsa/multi-year/curtailment-evolution
        // Expected Response: {
        //   success: true,
        //   years: [2025, 2030, 2035, 2040, 2045, 2050],
        //   total_curtailment: [5250, 8750, 12625, 16875, 21250, 25625],
        //   curtailment_rate: [1.5, 2.1, 2.5, 2.9, 3.2, 3.4],
        //   by_carrier: {
        //     wind: [3500, 5833, 8417, 11250, 14167, 17083],
        //     solar: [1750, 2917, 4208, 5625, 7083, 8542]
        //   },
        //   reasons: {
        //     transmission_congestion: [2625, 4375, 6313, 8438, 10625, 12813],
        //     overgeneration: [2625, 4375, 6312, 8437, 10625, 12812]
        //   }
        // }
    },

    // RELIABILITY & ADEQUACY
    { 
        id: 'adequacy-evolution', 
        label: 'System Adequacy', 
        icon: ShieldAlert,
        color: 'green',
        description: 'Reliability metrics over time',
        category: 'Reliability',
        // API: GET /project/pypsa/multi-year/adequacy-evolution
        // Expected Response: {
        //   success: true,
        //   years: [2025, 2030, 2035, 2040, 2045, 2050],
        //   reserve_margin: [31.6, 28.7, 25.6, 22.4, 19.0, 15.6],
        //   firm_capacity_margin: [57.9, 52.8, 47.1, 41.0, 34.4, 27.5],
        //   loss_of_load_hours: [0.5, 0.8, 1.2, 1.8, 2.5, 3.5],
        //   unserved_energy: [47.5, 85.0, 145.2, 252.9, 414.4, 651.9],
        //   LOLE: [0.05, 0.09, 0.15, 0.26, 0.42, 0.66]
        // }
    },
    { 
        id: 'flexibility-evolution', 
        label: 'System Flexibility', 
        icon: Repeat,
        color: 'purple',
        description: 'Flexibility resources over time',
        category: 'Reliability',
        // API: GET /project/pypsa/multi-year/flexibility-evolution
        // Expected Response: {
        //   success: true,
        //   years: [2025, 2030, 2035, 2040, 2045, 2050],
        //   total_flexibility: [50000, 67500, 90000, 117500, 150000, 187500],
        //   by_type: {
        //     storage: [20000, 30000, 45000, 62500, 85000, 112500],
        //     demand_response: [15000, 20000, 25000, 30000, 35000, 40000],
        //     flexible_generation: [15000, 17500, 20000, 25000, 30000, 35000]
        //   },
        //   ramp_capability: [25000, 32500, 42500, 55000, 70000, 87500]
        // }
    },

    // ECONOMIC & INVESTMENT
    { 
        id: 'investment-timeline', 
        label: 'Investment Timeline', 
        icon: DollarSign,
        color: 'blue',
        description: 'When and where investments happen',
        category: 'Economics',
        // API: GET /project/pypsa/multi-year/investment-timeline
        // Expected Response: {
        //   success: true,
        //   years: [2025, 2030, 2035, 2040, 2045, 2050],
        //   annual_investment: [170000000, 200000000, 150000000, 100000000, 50000000, 25000000],
        //   cumulative_investment: [170000000, 370000000, 520000000, 620000000, 670000000, 695000000],
        //   by_technology: {
        //     wind: [60000000, 80000000, 65000000, 45000000, 25000000, 15000000],
        //     solar: [45000000, 60000000, 50000000, 35000000, 15000000, 5000000],
        //     battery: [40000000, 35000000, 20000000, 10000000, 5000000, 2500000],
        //     transmission: [25000000, 25000000, 15000000, 10000000, 5000000, 2500000]
        //   },
        //   decommissioning: [0, 5000000, 15000000, 25000000, 35000000, 45000000]
        // }
    },
    { 
        id: 'price-evolution', 
        label: 'Price Evolution', 
        icon: TrendingUp,
        color: 'yellow',
        description: 'How electricity prices change',
        category: 'Economics',
        // API: GET /project/pypsa/multi-year/price-evolution
        // Expected Response: {
        //   success: true,
        //   years: [2025, 2030, 2035, 2040, 2045, 2050],
        //   avg_price: [50.2, 47.5, 45.2, 43.5, 42.0, 40.8],
        //   peak_price: [150.5, 135.2, 122.8, 112.5, 104.2, 97.5],
        //   off_peak_price: [25.5, 28.2, 30.5, 32.2, 33.5, 34.5],
        //   price_volatility: [85.2, 78.5, 72.8, 67.5, 62.8, 58.5],
        //   by_zone: {
        //     DE: [48.5, 45.8, 43.5, 41.8, 40.5, 39.5],
        //     FR: [52.5, 49.5, 47.2, 45.5, 44.0, 42.8]
        //   }
        // }
    },
    { 
        id: 'learning-curves', 
        label: 'Technology Learning', 
        icon: TrendingDown,
        color: 'indigo',
        description: 'Cost reductions over time',
        category: 'Economics',
        // API: GET /project/pypsa/multi-year/learning-curves
        // Expected Response: {
        //   success: true,
        //   years: [2025, 2030, 2035, 2040, 2045, 2050],
        //   capital_cost_reduction: {
        //     'wind-onshore': [1200, 1080, 972, 875, 787, 709],
        //     'wind-offshore': [2500, 2200, 1936, 1703, 1498, 1318],
        //     'solar-PV': [800, 640, 512, 410, 328, 262],
        //     'battery': [150, 105, 74, 52, 36, 25]
        //   },
        //   learning_rate: {
        //     'wind-onshore': 10.0,
        //     'wind-offshore': 12.0,
        //     'solar-PV': 20.0,
        //     'battery': 18.0
        //   }
        // }
    },

    // ENVIRONMENTAL & POLICY
    { 
        id: 'carbon-intensity', 
        label: 'Carbon Intensity', 
        icon: Activity,
        color: 'orange',
        description: 'Emissions per MWh over time',
        category: 'Environment',
        // API: GET /project/pypsa/multi-year/carbon-intensity
        // Expected Response: {
        //   success: true,
        //   years: [2025, 2030, 2035, 2040, 2045, 2050],
        //   avg_intensity: [0.193, 0.132, 0.085, 0.050, 0.024, 0.009],
        //   marginal_intensity: [0.450, 0.380, 0.280, 0.180, 0.080, 0.020],
        //   by_hour: {
        //     peak_hours: [0.250, 0.175, 0.115, 0.070, 0.035, 0.015],
        //     off_peak_hours: [0.150, 0.095, 0.055, 0.030, 0.012, 0.003]
        //   },
        //   improvement_rate: [0, 31.6, 35.6, 41.2, 52.0, 62.5]
        // }
    },
    { 
        id: 'policy-impact', 
        label: 'Policy Impact Analysis', 
        icon: Target,
        color: 'red',
        description: 'How constraints affect outcomes',
        category: 'Environment',
        // API: GET /project/pypsa/multi-year/policy-impact
        // Expected Response: {
        //   success: true,
        //   years: [2025, 2030, 2035, 2040, 2045, 2050],
        //   co2_constraint: {
        //     limit: [100000000, 75000000, 50000000, 25000000, 10000000, 5000000],
        //     actual: [67500000, 56250000, 42750000, 29250000, 15750000, 6750000],
        //     shadow_price: [0, 25.5, 58.2, 125.8, 285.5, 650.2]
        //   },
        //   renewable_target: {
        //     target: [35.0, 50.0, 65.0, 75.0, 85.0, 95.0],
        //     actual: [37.1, 49.4, 61.5, 73.0, 83.6, 92.0],
        //     compliance: [true, false, false, false, false, false]
        //   },
        //   cost_impact: [0, 50000000, 125000000, 225000000, 325000000, 425000000]
        // }
    },
    { 
        id: 'fuel-mix-evolution', 
        label: 'Fuel Mix Evolution', 
        icon: Fuel,
        color: 'slate',
        description: 'Primary energy sources over time',
        category: 'Environment',
        // API: GET /project/pypsa/multi-year/fuel-mix-evolution
        // Expected Response: {
        //   success: true,
        //   years: [2025, 2030, 2035, 2040, 2045, 2050],
        //   primary_energy: {
        //     wind: [85000, 125000, 175000, 225000, 275000, 325000],
        //     solar: [45000, 85000, 135000, 185000, 235000, 285000],
        //     natural_gas: [150000, 125000, 95000, 65000, 35000, 15000],
        //     nuclear: [70000, 85000, 100000, 100000, 100000, 100000]
        //   },
        //   import_dependence: [15.2, 12.5, 9.8, 7.2, 4.5, 2.2]
        // }
    },

    // REGIONAL & SPATIAL
    { 
        id: 'regional-evolution', 
        label: 'Regional Analysis', 
        icon: Globe,
        color: 'cyan',
        description: 'How different regions evolve',
        category: 'Regional',
        // API: GET /project/pypsa/multi-year/regional-evolution
        // Expected Response: {
        //   success: true,
        //   years: [2025, 2030, 2035, 2040, 2045, 2050],
        //   by_region: {
        //     DE: {
        //       capacity: [35000, 43750, 52500, 61250, 70000, 78750],
        //       generation: [125000, 148750, 172500, 196250, 220000, 243750],
        //       demand: [125000, 148750, 172500, 196250, 220000, 243750],
        //       renewable_share: [40.0, 52.0, 64.0, 74.4, 83.2, 90.4]
        //     },
        //     FR: {
        //       capacity: [30000, 37500, 45000, 52500, 60000, 67500],
        //       generation: [110000, 131250, 152500, 173750, 195000, 216250],
        //       demand: [110000, 131250, 152500, 173750, 195000, 216250],
        //       renewable_share: [35.5, 48.1, 60.5, 72.2, 82.6, 91.2]
        //     }
        //   }
        // }
    },
    { 
        id: 'network-topology', 
        label: 'Network Topology Changes', 
        icon: MapPin,
        color: 'purple',
        description: 'New buses, lines added over time',
        category: 'Regional',
        // API: GET /project/pypsa/multi-year/network-topology
        // Expected Response: {
        //   success: true,
        //   years: [2025, 2030, 2035, 2040, 2045, 2050],
        //   num_buses: [120, 145, 168, 189, 208, 225],
        //   num_lines: [180, 215, 248, 278, 306, 332],
        //   num_links: [95, 125, 153, 179, 203, 225],
        //   new_buses_added: [0, 25, 23, 21, 19, 17],
        //   new_lines_added: [0, 35, 33, 30, 28, 26],
        //   network_density: [1.50, 1.48, 1.48, 1.47, 1.47, 1.48]
        // }
    },

    // OPERATIONAL & PERFORMANCE
    { 
        id: 'storage-operation-evolution', 
        label: 'Storage Operation', 
        icon: Battery,
        color: 'emerald',
        description: 'How storage usage patterns change',
        category: 'Storage',
        // API: GET /project/pypsa/multi-year/storage-operation-evolution
        // Expected Response: {
        //   success: true,
        //   years: [2025, 2030, 2035, 2040, 2045, 2050],
        //   total_cycles: {
        //     PHS: [5483, 5850, 6215, 6580, 6945, 7310],
        //     battery: [450, 550, 650, 750, 850, 950]
        //   },
        //   utilization: {
        //     PHS: [62.5, 65.8, 69.1, 72.4, 75.7, 79.0],
        //     battery: [85.0, 87.5, 90.0, 92.5, 95.0, 97.5]
        //   },
        //   arbitrage_value: [50000000, 75000000, 100000000, 125000000, 150000000, 175000000]
        // }
    },
    { 
        id: 'scenario-comparison', 
        label: 'Scenario Comparison', 
        icon: PieChart,
        color: 'indigo',
        description: 'Compare multiple scenarios',
        category: 'Comparison',
        // API: GET /project/pypsa/multi-year/scenario-comparison
        // Query Parameters: scenarios (array of scenario names)
        // Expected Response: {
        //   success: true,
        //   scenarios: ['baseline', 'ambitious', 'conservative'],
        //   years: [2025, 2030, 2035, 2040, 2045, 2050],
        //   comparison_metrics: {
        //     total_cost: {
        //       baseline: [1250000000, 1375000000, 1450000000, 1500000000, 1525000000, 1550000000],
        //       ambitious: [1350000000, 1425000000, 1475000000, 1500000000, 1500000000, 1500000000],
        //       conservative: [1200000000, 1350000000, 1475000000, 1575000000, 1650000000, 1700000000]
        //     },
        //     renewable_share: {
        //       baseline: [37.1, 49.4, 61.5, 73.0, 83.6, 92.0],
        //       ambitious: [45.0, 60.0, 75.0, 85.0, 92.0, 97.0],
        //       conservative: [30.0, 40.0, 50.0, 60.0, 70.0, 80.0]
        //     },
        //     emissions: {
        //       baseline: [67500000, 56250000, 42750000, 29250000, 15750000, 6750000],
        //       ambitious: [56250000, 42750000, 29250000, 15750000, 6750000, 2250000],
        //       conservative: [78750000, 67500000, 56250000, 42750000, 29250000, 15750000]
        //     }
        //   }
        // }
    },

    // ADVANCED ANALYTICS
    { 
        id: 'sensitivity-analysis', 
        label: 'Sensitivity Analysis', 
        icon: Target,
        color: 'violet',
        description: 'Impact of key assumptions',
        category: 'Analytics',
        // API: GET /project/pypsa/multi-year/sensitivity-analysis
        // Expected Response: {
        //   success: true,
        //   base_case: 'baseline',
        //   sensitivity_parameters: ['demand_growth', 'technology_cost', 'fuel_price', 'co2_price'],
        //   results: {
        //     demand_growth: {
        //       '-20%': { total_cost: 1125000000, renewable_share: 42.5 },
        //       'base': { total_cost: 1250000000, renewable_share: 37.1 },
        //       '+20%': { total_cost: 1375000000, renewable_share: 32.8 }
        //     },
        //     technology_cost: {
        //       '-30%': { total_cost: 1000000000, renewable_share: 52.5 },
        //       'base': { total_cost: 1250000000, renewable_share: 37.1 },
        //       '+30%': { total_cost: 1500000000, renewable_share: 28.5 }
        //     }
        //   }
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

// Group analysis types by category
const analysisCategories = {
    'Generation': analysisTypes.filter(t => t.category === 'Generation'),
    'Performance': analysisTypes.filter(t => t.category === 'Performance'),
    'Storage': analysisTypes.filter(t => t.category === 'Storage'),
    'Transmission': analysisTypes.filter(t => t.category === 'Transmission'),
    'Demand': analysisTypes.filter(t => t.category === 'Demand'),
    'Renewables': analysisTypes.filter(t => t.category === 'Renewables'),
    'Reliability': analysisTypes.filter(t => t.category === 'Reliability'),
    'Economics': analysisTypes.filter(t => t.category === 'Economics'),
    'Environment': analysisTypes.filter(t => t.category === 'Environment'),
    'Regional': analysisTypes.filter(t => t.category === 'Regional'),
    'Comparison': analysisTypes.filter(t => t.category === 'Comparison'),
    'Analytics': analysisTypes.filter(t => t.category === 'Analytics')
};

const MultiYearNetworkView = ({ projectPath, selectedScenario, multiYearInfo }) => {
    const [selectedAnalysisType, setSelectedAnalysisType] = useState('');
    const [analysisData, setAnalysisData] = useState(null);
    const [loadingAnalysisData, setLoadingAnalysisData] = useState(false);
    const [analysisError, setAnalysisError] = useState(null);

    // Handle analysis type selection
    const handleAnalysisTypeSelect = useCallback(async (analysisType) => {
        setSelectedAnalysisType(analysisType);
        setAnalysisData(null);
        setAnalysisError(null);

        // Fetch analysis data
        if (projectPath && selectedScenario) {
            await fetchAnalysisData(analysisType);
        }
    }, [projectPath, selectedScenario]);

    // Fetch analysis data (on-demand)
    const fetchAnalysisData = async (analysisType) => {
        setLoadingAnalysisData(true);
        setAnalysisError(null);

        try {
            const response = await axios.get(`/project/pypsa/multi-year/${analysisType}`, {
                params: {
                    projectPath: projectPath,
                    scenarioName: selectedScenario
                }
            });

            if (response.data.success) {
                setAnalysisData(response.data);
            }
        } catch (error) {
            console.error(`Error fetching ${analysisType} data:`, error);
            setAnalysisError(error.response?.data?.detail || error.message || 'Failed to load analysis data');
        } finally {
            setLoadingAnalysisData(false);
        }
    };

    return (
        <div className="flex flex-1 overflow-hidden">
            {/* Enhanced Sidebar - Multi-Year Analysis */}
            <aside className="w-80 flex-shrink-0 bg-white border-r border-slate-200 shadow-lg flex flex-col">
                {/* Sidebar Header */}
                <div className="p-6 border-b border-slate-200 bg-gradient-to-br from-indigo-50 via-blue-50 to-slate-50">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-indigo-100 rounded-lg">
                            <Calendar className="w-5 h-5 text-indigo-600" />
                        </div>
                        <h2 className="text-lg font-bold text-slate-800">Multi-Year Analysis</h2>
                    </div>
                    
                    <div className="space-y-2">
                        <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                            Selected Scenario
                        </div>
                        <div className="p-4 bg-white rounded-xl border-2 border-indigo-200 shadow-sm">
                            <div className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-indigo-600" />
                                {selectedScenario}
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                                <span className="px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-lg font-semibold">
                                    {multiYearInfo.start_year}
                                </span>
                                <span className="text-slate-400">→</span>
                                <span className="px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-lg font-semibold">
                                    {multiYearInfo.end_year}
                                </span>
                                <span className="ml-auto text-slate-500 font-medium">
                                    {multiYearInfo.count} years
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Analysis Types List - Grouped by Category */}
                <div className="flex-grow overflow-y-auto p-4">
                    {Object.entries(analysisCategories).map(([categoryName, types]) => (
                        types.length > 0 && (
                            <div key={categoryName} className="mb-6">
                                <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 px-2">
                                    {categoryName}
                                </h3>
                                <div className="space-y-1">
                                    {types.map(analysisType => {
                                        const isSelected = selectedAnalysisType === analysisType.id;
                                        const colors = colorClasses[analysisType.color];
                                        const Icon = analysisType.icon;
                                        
                                        return (
                                            <button
                                                key={analysisType.id}
                                                onClick={() => handleAnalysisTypeSelect(analysisType.id)}
                                                className={`
                                                    w-full text-left px-3 py-2 rounded-lg font-medium transition-all duration-200
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
                                                            size={14} 
                                                            className={isSelected ? 'text-white' : colors.text}
                                                        />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-xs font-semibold truncate">
                                                            {analysisType.label}
                                                        </div>
                                                        {!isSelected && (
                                                            <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                                                                {analysisType.description}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )
                    ))}
                </div>
            </aside>

            {/* Main Content - Multi-Year Analysis Results */}
            <main className="flex-1 p-6 overflow-y-auto bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
                <div className="max-w-7xl mx-auto">
                    {!selectedAnalysisType ? (
                        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-20">
                            <div className="flex items-center justify-center text-slate-500">
                                <div className="text-center max-w-md">
                                    <div className="inline-flex p-4 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl mb-6">
                                        <NetworkIcon className="w-16 h-16 text-blue-600" />
                                    </div>
                                    <p className="text-2xl font-bold text-slate-800 mb-3">
                                        Select an Analysis Type
                                    </p>
                                    <p className="text-slate-500 leading-relaxed">
                                        Choose an analysis from the sidebar to explore year-on-year trends and insights across your multi-year scenario
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : loadingAnalysisData ? (
                        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-20">
                            <div className="flex flex-col items-center justify-center text-slate-500">
                                <div className="relative mb-6">
                                    <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
                                    <div className="absolute inset-0 w-12 h-12 animate-ping text-blue-400 opacity-20">
                                        <Loader2 className="w-full h-full" />
                                    </div>
                                </div>
                                <span className="text-xl font-bold text-slate-700 mb-2">
                                    Loading analysis data...
                                </span>
                                <span className="text-sm text-slate-500">
                                    This may take a moment
                                </span>
                            </div>
                        </div>
                    ) : analysisError ? (
                        <div className="bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-200 rounded-2xl p-8 shadow-lg">
                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-red-200 rounded-xl">
                                    <NetworkIcon className="w-6 h-6 text-red-700" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-red-900 mb-2">Error Loading Analysis</h3>
                                    <p className="text-red-700 font-medium">{analysisError}</p>
                                </div>
                            </div>
                        </div>
                    ) : analysisData ? (
                        <div className="space-y-6">
                            {/* Analysis Header */}
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        {(() => {
                                            const currentType = analysisTypes.find(t => t.id === selectedAnalysisType);
                                            const Icon = currentType?.icon || NetworkIcon;
                                            const colors = colorClasses[currentType?.color || 'blue'];
                                            
                                            return (
                                                <>
                                                    <div className={`p-3 ${colors.bgLight} rounded-xl`}>
                                                        <Icon className={`w-7 h-7 ${colors.text}`} />
                                                    </div>
                                                    <div>
                                                        <h2 className="text-2xl font-bold text-slate-800">
                                                            {currentType?.label}
                                                        </h2>
                                                        <p className="text-sm text-slate-500 mt-1">
                                                            {currentType?.description}
                                                        </p>
                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-semibold text-slate-600">Time Range</div>
                                        <div className="text-lg font-bold text-slate-800">
                                            {multiYearInfo.start_year} - {multiYearInfo.end_year}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Chart Container */}
                            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
                                {/* Render existing charts */}
                                {selectedAnalysisType === 'capacity-evolution' && (
                                    <CapacityEvolutionChart data={analysisData} />
                                )}
                                {selectedAnalysisType === 'energy-mix-evolution' && (
                                    <EnergyMixEvolutionChart data={analysisData} />
                                )}
                                {selectedAnalysisType === 'cuf-evolution' && (
                                    <CUFEvolutionChart data={analysisData} />
                                )}
                                {selectedAnalysisType === 'emissions-evolution' && (
                                    <EmissionsEvolutionChart data={analysisData} />
                                )}
                                {selectedAnalysisType === 'storage-evolution' && (
                                    <StorageEvolutionChart data={analysisData} />
                                )}
                                {selectedAnalysisType === 'cost-evolution' && (
                                    <CostEvolutionChart data={analysisData} />
                                )}
                                
                                {/* Placeholder for new charts */}
                                {!['capacity-evolution', 'energy-mix-evolution', 'cuf-evolution', 'emissions-evolution', 'storage-evolution', 'cost-evolution'].includes(selectedAnalysisType) && (
                                    <div className="text-center py-16">
                                        <div className="inline-flex p-4 bg-blue-50 rounded-2xl mb-4">
                                            {(() => {
                                                const currentType = analysisTypes.find(t => t.id === selectedAnalysisType);
                                                const Icon = currentType?.icon || NetworkIcon;
                                                return <Icon className="w-16 h-16 text-blue-600" />;
                                            })()}
                                        </div>
                                        <p className="text-lg font-semibold text-slate-800 mb-2">
                                            Backend Implementation Required
                                        </p>
                                        <p className="text-sm text-slate-500 mb-4">
                                            This analysis view is ready on the frontend and waiting for backend API implementation
                                        </p>
                                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto text-left">
                                            <p className="text-xs font-semibold text-blue-900 mb-1">API Endpoint</p>
                                            <p className="text-xs text-blue-700 font-mono">
                                                GET /project/pypsa/multi-year/{selectedAnalysisType}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : null}
                </div>
            </main>
        </div>
    );
};

export default MultiYearNetworkView;