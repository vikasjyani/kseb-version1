/**
 * Utility functions for PyPSA visualizations
 */

/**
 * Color palette for different energy carriers/technologies
 */
export const CARRIER_COLORS = {
  // Renewables
  solar: '#FFD700',
  pv: '#FFD700',
  'solar thermal': '#FFA500',
  wind: '#87CEEB',
  onwind: '#87CEEB',
  offwind: '#4682B4',
  hydro: '#0073CF',
  ror: '#3399FF',
  reservoir: '#0056A3',
  biomass: '#228B22',
  biogas: '#32CD32',

  // Fossil fuels
  coal: '#000000',
  lignite: '#4B4B4B',
  oil: '#FF4500',
  gas: '#FF6347',
  OCGT: '#FFA07A',
  CCGT: '#FF6B6B',

  // Nuclear
  nuclear: '#800080',

  // Storage
  battery: '#005B5B',
  Battery: '#005B5B',
  phs: '#3399FF',
  PHS: '#3399FF',
  hydrogen: '#AFEEEE',
  H2: '#AFEEEE',
  'heat storage': '#CD5C5C',

  // Other
  load: '#000000',
  curtailment: '#FF00FF',
  import: '#808080',
  export: '#A9A9A9',
  other: '#D3D3D3'
};

/**
 * Get color for a carrier/technology
 * @param {string} carrier - Carrier name
 * @returns {string} Hex color code
 */
export const getCarrierColor = (carrier) => {
  const lowerCarrier = carrier?.toLowerCase();

  // Direct match
  if (CARRIER_COLORS[carrier]) return CARRIER_COLORS[carrier];
  if (CARRIER_COLORS[lowerCarrier]) return CARRIER_COLORS[lowerCarrier];

  // Partial match
  for (const [key, color] of Object.entries(CARRIER_COLORS)) {
    if (lowerCarrier?.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerCarrier)) {
      return color;
    }
  }

  // Generate consistent color from string hash
  return generateColorFromString(carrier);
};

/**
 * Generate consistent color from string hash
 * @param {string} str - String to hash
 * @returns {string} Hex color code
 */
const generateColorFromString = (str) => {
  if (!str) return '#D3D3D3';

  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  const h = hash % 360;
  const s = 65 + (hash % 20);
  const l = 45 + (hash % 20);

  return hslToHex(h, s, l);
};

/**
 * Convert HSL to Hex
 */
const hslToHex = (h, s, l) => {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

/**
 * Format large numbers with abbreviations
 * @param {number} num - Number to format
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted number
 */
export const formatLargeNumber = (num, decimals = 1) => {
  if (num === null || num === undefined) return 'N/A';

  const absNum = Math.abs(num);

  if (absNum >= 1e9) {
    return (num / 1e9).toFixed(decimals) + 'B';
  } else if (absNum >= 1e6) {
    return (num / 1e6).toFixed(decimals) + 'M';
  } else if (absNum >= 1e3) {
    return (num / 1e3).toFixed(decimals) + 'K';
  }

  return num.toFixed(decimals);
};

/**
 * Format percentage
 * @param {number} value - Value (0-1 or 0-100)
 * @param {boolean} isDecimal - Whether input is decimal (0-1)
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted percentage
 */
export const formatPercentage = (value, isDecimal = false, decimals = 1) => {
  if (value === null || value === undefined) return 'N/A';

  const percentage = isDecimal ? value * 100 : value;
  return percentage.toFixed(decimals) + '%';
};

/**
 * Format energy value with unit
 * @param {number} value - Energy value in MWh
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted energy with unit
 */
export const formatEnergy = (value, decimals = 1) => {
  if (value === null || value === undefined) return 'N/A';

  const absValue = Math.abs(value);

  if (absValue >= 1e6) {
    return (value / 1e6).toFixed(decimals) + ' TWh';
  } else if (absValue >= 1e3) {
    return (value / 1e3).toFixed(decimals) + ' GWh';
  }

  return value.toFixed(decimals) + ' MWh';
};

/**
 * Format power value with unit
 * @param {number} value - Power value in MW
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted power with unit
 */
export const formatPower = (value, decimals = 1) => {
  if (value === null || value === undefined) return 'N/A';

  const absValue = Math.abs(value);

  if (absValue >= 1e3) {
    return (value / 1e3).toFixed(decimals) + ' GW';
  }

  return value.toFixed(decimals) + ' MW';
};

/**
 * Format cost value with unit
 * @param {number} value - Cost value
 * @param {string} currency - Currency symbol
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted cost with unit
 */
export const formatCost = (value, currency = '€', decimals = 1) => {
  if (value === null || value === undefined) return 'N/A';

  const absValue = Math.abs(value);

  if (absValue >= 1e9) {
    return currency + (value / 1e9).toFixed(decimals) + 'B';
  } else if (absValue >= 1e6) {
    return currency + (value / 1e6).toFixed(decimals) + 'M';
  } else if (absValue >= 1e3) {
    return currency + (value / 1e3).toFixed(decimals) + 'K';
  }

  return currency + value.toFixed(decimals);
};

/**
 * Sort carriers/technologies by predefined order
 * @param {Array} carriers - Array of carrier names
 * @returns {Array} Sorted carriers
 */
export const sortCarriers = (carriers) => {
  const order = {
    // Renewables first
    solar: 1, pv: 1, wind: 2, onwind: 2, offwind: 3,
    hydro: 4, ror: 4, reservoir: 4,
    biomass: 5, biogas: 5,
    // Nuclear
    nuclear: 10,
    // Fossil fuels
    gas: 20, CCGT: 20, OCGT: 21,
    coal: 30, lignite: 31,
    oil: 40,
    // Storage
    battery: 50, phs: 51, hydrogen: 52,
    // Other
    other: 100
  };

  return [...carriers].sort((a, b) => {
    const aOrder = order[a?.toLowerCase()] || 100;
    const bOrder = order[b?.toLowerCase()] || 100;
    return aOrder - bOrder;
  });
};

/**
 * Calculate total from array of objects
 * @param {Array} data - Array of data objects
 * @param {string} key - Key to sum
 * @returns {number} Total
 */
export const calculateTotal = (data, key) => {
  if (!data || !Array.isArray(data)) return 0;
  return data.reduce((sum, item) => sum + (item[key] || 0), 0);
};

/**
 * Group data by key
 * @param {Array} data - Array of data objects
 * @param {string} key - Key to group by
 * @returns {Object} Grouped data
 */
export const groupBy = (data, key) => {
  if (!data || !Array.isArray(data)) return {};

  return data.reduce((groups, item) => {
    const group = item[key];
    if (!groups[group]) {
      groups[group] = [];
    }
    groups[group].push(item);
    return groups;
  }, {});
};

/**
 * Check if data is empty
 * @param {any} data - Data to check
 * @returns {boolean} True if empty
 */
export const isEmpty = (data) => {
  if (data === null || data === undefined) return true;
  if (Array.isArray(data)) return data.length === 0;
  if (typeof data === 'object') return Object.keys(data).length === 0;
  return false;
};

/**
 * Get friendly name for analysis type
 * @param {string} analysisKey - Analysis key
 * @returns {string} Friendly name
 */
export const getAnalysisName = (analysisKey) => {
  const names = {
    total_capacities: 'Total Capacities',
    zonal_capacities: 'Zonal Capacities',
    capacity_factors: 'Capacity Factors',
    total_energy: 'Total Energy',
    energy_mix: 'Energy Mix',
    generation_dispatch: 'Generation Dispatch',
    plant_operation: 'Plant Operation',
    utilization: 'Utilization',
    storage_output: 'Storage Output',
    storage_state_of_charge: 'Storage State of Charge',
    transmission_flows: 'Transmission Flows',
    line_loading: 'Line Loading',
    system_costs: 'System Costs',
    energy_prices: 'Energy Prices',
    emissions: 'Emissions',
    emission_factors: 'Emission Factors',
    zonal_emissions: 'Zonal Emissions',
    daily_demand_supply: 'Daily Demand-Supply Balance',
    zonal_daily_demand_supply: 'Zonal Daily Balance',
    hourly_profiles: 'Hourly Profiles',
    curtailment: 'Curtailment',
    reserves: 'Reserves'
  };

  return names[analysisKey] || analysisKey;
};
