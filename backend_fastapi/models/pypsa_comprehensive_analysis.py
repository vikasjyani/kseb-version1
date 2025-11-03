"""
PyPSA Comprehensive Network Analysis Suite
==========================================

A unified module for comprehensive PyPSA network analysis including:
- Support for single and multiple network files (.nc format)
- Automatic temporal analysis (snapshots, years, periods)
- Component-wise analysis (generators, storage, transmission, loads)
- Advanced visualization data preparation
- Statistical analysis and metrics calculation
- Robust handling of different network configurations

Performance Optimizations:
- Memory-efficient DataFrame operations
- Lazy evaluation where possible
- Efficient aggregation using groupby
- Minimal data copying
- Automatic garbage collection hints
- Progress logging for long-running operations

Terminology:
- stores: Battery storage (MWh capacity)
- storage_units: Pump storage and others (MW capacity with max_hours)

Best Practices Implemented:
- Input validation and type checking
- Comprehensive error handling with context
- Defensive programming (check before access)
- Efficient pandas operations (vectorized where possible)
- Memory-efficient data structures
- Clear logging for debugging and monitoring

Author: KSEB Analytics Team
Date: January 2025
Documentation: https://docs.pypsa.org/
"""

import pypsa
import pandas as pd
import numpy as np
import logging
import warnings
import gc
from typing import Dict, List, Optional, Union, Tuple, Any
from pathlib import Path
from datetime import datetime
import json

# Configure logging and warnings
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)
warnings.filterwarnings('ignore')

# Memory optimization: Set pandas options
pd.options.mode.chained_assignment = None  # Disable false positive warnings
pd.options.mode.copy_on_write = True  # Enable copy-on-write for better memory usage


# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

def safe_get_attr(obj, attr: str, default=None):
    """
    Safely get attribute from object with default fallback.

    Args:
        obj: Object to get attribute from
        attr: Attribute name
        default: Default value if attribute doesn't exist

    Returns:
        Attribute value or default
    """
    try:
        return getattr(obj, attr, default)
    except Exception as e:
        logger.debug(f"Error getting attribute {attr}: {e}")
        return default


def safe_dataframe_operation(func, *args, default_value=None, error_msg="DataFrame operation failed", **kwargs):
    """
    Safely execute DataFrame operation with error handling.

    Args:
        func: Function to execute
        *args: Positional arguments
        default_value: Value to return on error
        error_msg: Error message prefix
        **kwargs: Keyword arguments

    Returns:
        Function result or default_value on error
    """
    try:
        return func(*args, **kwargs)
    except Exception as e:
        logger.error(f"{error_msg}: {e}")
        return default_value if default_value is not None else pd.DataFrame()


def load_network_file(filepath: Union[str, Path]) -> pypsa.Network:
    """
    Load a PyPSA network from .nc file with validation and error handling.

    Args:
        filepath: Path to network file

    Returns:
        pypsa.Network: Loaded network

    Raises:
        FileNotFoundError: If file doesn't exist
        ValueError: If file format is invalid
        Exception: For other loading errors
    """
    filepath = Path(filepath)

    # Validate file existence
    if not filepath.exists():
        raise FileNotFoundError(f"Network file not found: {filepath}")

    # Validate file extension
    if filepath.suffix != '.nc':
        raise ValueError(f"Only .nc files supported, got: {filepath.suffix}")

    # Check file size for memory planning
    file_size_mb = filepath.stat().st_size / (1024 * 1024)
    logger.info(f"Loading network from: {filepath} (Size: {file_size_mb:.2f} MB)")

    try:
        # Load network
        network = pypsa.Network(filepath.as_posix())

        # Validate network loaded successfully
        if not hasattr(network, 'snapshots'):
            raise ValueError("Network loaded but snapshots not found")

        logger.info(f"Network loaded successfully. Snapshots: {len(network.snapshots)}, "
                   f"Components: {len(network.components)}")

        return network

    except Exception as e:
        logger.error(f"Failed to load network from {filepath}: {e}")
        raise Exception(f"Network loading failed: {str(e)}")


def get_snapshot_info(network: pypsa.Network) -> Dict:
    """Extract detailed snapshot information from network."""
    info = {
        'total_snapshots': 0,
        'is_multi_period': False,
        'periods': [],
        'years': [],
        'months': [],
        'date_range': None,
        'time_resolution': None
    }

    if not hasattr(network, 'snapshots') or network.snapshots.empty:
        return info

    snapshots = network.snapshots
    info['total_snapshots'] = len(snapshots)

    # Check for multi-period
    if isinstance(snapshots, pd.MultiIndex):
        info['is_multi_period'] = True
        if 'period' in snapshots.names or snapshots.nlevels > 1:
            info['periods'] = list(snapshots.levels[0].unique())
            time_level = snapshots.get_level_values(-1)
        else:
            time_level = snapshots
    else:
        time_level = snapshots

    # Extract temporal information
    if pd.api.types.is_datetime64_any_dtype(time_level):
        info['years'] = sorted(list(time_level.year.unique()))
        info['months'] = sorted(list(time_level.month.unique()))
        info['date_range'] = (time_level.min(), time_level.max())

        # Estimate time resolution
        if len(time_level) > 1:
            diffs = pd.Series(time_level).diff().dropna()
            mode_diff = diffs.mode()[0] if not diffs.empty else pd.Timedelta(hours=1)
            info['time_resolution'] = mode_diff

    return info


# =============================================================================
# NETWORK INSPECTOR CLASS
# =============================================================================

class NetworkInspector:
    """Comprehensive network inspection and validation."""

    def __init__(self, network: pypsa.Network):
        self.network = network
        self.info = self._inspect()

    def _inspect(self) -> Dict:
        """Perform comprehensive network inspection."""
        n = self.network
        info = {
            'name': getattr(n, 'name', 'Unnamed Network'),
            'is_solved': False,
            'solver_status': None,
            'objective_value': None,
            'components': {},
            'carriers': [],
            'buses': [],
            'time_info': get_snapshot_info(n),
            'has_stores': False,
            'has_storage_units': False
        }

        # Check components
        component_types = ['buses', 'generators', 'loads', 'storage_units',
                          'stores', 'lines', 'links', 'transformers']

        for comp in component_types:
            if hasattr(n, comp):
                df = getattr(n, comp)
                if not df.empty:
                    info['components'][comp] = {
                        'count': len(df),
                        'columns': list(df.columns)
                    }

                    # Check for time series data
                    ts_attr = f'{comp}_t'
                    if hasattr(n, ts_attr):
                        ts_dict = getattr(n, ts_attr)
                        if ts_dict and any(not v.empty for v in ts_dict.values() if hasattr(v, 'empty')):
                            info['components'][comp]['has_time_series'] = True

        # Special flags for storage
        if 'stores' in info['components']:
            info['has_stores'] = True  # Battery storage (MWh)
        if 'storage_units' in info['components']:
            info['has_storage_units'] = True  # Pump storage (MW)

        # Check if solved
        if hasattr(n, 'generators_t') and hasattr(n.generators_t, 'p'):
            if not n.generators_t.p.empty:
                info['is_solved'] = True

        # Get objective
        if hasattr(n, 'objective'):
            info['objective_value'] = n.objective

        # Extract carriers
        if hasattr(n, 'carriers') and not n.carriers.empty:
            info['carriers'] = list(n.carriers.index)

        # Extract buses
        if hasattr(n, 'buses') and not n.buses.empty:
            info['buses'] = list(n.buses.index)
            # Group buses by region/zone if available
            if 'country' in n.buses.columns:
                info['zones'] = list(n.buses['country'].unique())
            elif 'x' in n.buses.columns and 'y' in n.buses.columns:
                info['has_coordinates'] = True

        return info


# =============================================================================
# PYPSA COMPREHENSIVE ANALYZER
# =============================================================================

class PyPSAComprehensiveAnalyzer:
    """Comprehensive analyzer for PyPSA networks with all requested analyses."""

    def __init__(self, network: pypsa.Network):
        self.network = network
        self.inspector = NetworkInspector(network)
        self.n = network

    # =========================================================================
    # 1. TOTAL CAPACITIES ANALYSIS
    # =========================================================================

    def get_total_capacities(self) -> Dict[str, pd.DataFrame]:
        """
        Get total installed capacities by technology and zone.

        Returns capacity in MW for generators and storage_units,
        and MWh for stores (batteries).
        """
        results = {}

        # Generators capacity by carrier
        if hasattr(self.n, 'generators') and not self.n.generators.empty:
            gen_capacity = pd.DataFrame()

            # Use optimal capacity if available, else nominal
            capacity_col = 'p_nom_opt' if 'p_nom_opt' in self.n.generators.columns else 'p_nom'

            gen_capacity['Capacity_MW'] = self.n.generators.groupby('carrier')[capacity_col].sum()
            gen_capacity['Count'] = self.n.generators.groupby('carrier').size()
            gen_capacity['Technology'] = gen_capacity.index

            results['generators'] = gen_capacity.reset_index(drop=True)

        # Storage Units capacity (MW) - Pump storage and similar
        if hasattr(self.n, 'storage_units') and not self.n.storage_units.empty:
            su_capacity = pd.DataFrame()

            capacity_col = 'p_nom_opt' if 'p_nom_opt' in self.n.storage_units.columns else 'p_nom'

            su_capacity['Power_Capacity_MW'] = self.n.storage_units.groupby('carrier')[capacity_col].sum()

            # Energy capacity (MW * max_hours)
            if 'max_hours' in self.n.storage_units.columns:
                energy_capacity = (self.n.storage_units[capacity_col] *
                                 self.n.storage_units['max_hours'])
                su_capacity['Energy_Capacity_MWh'] = self.n.storage_units.groupby('carrier').apply(
                    lambda x: (x[capacity_col] * x['max_hours']).sum()
                )

            su_capacity['Count'] = self.n.storage_units.groupby('carrier').size()
            su_capacity['Technology'] = su_capacity.index

            results['storage_units'] = su_capacity.reset_index(drop=True)

        # Stores capacity (MWh) - Battery storage
        if hasattr(self.n, 'stores') and not self.n.stores.empty:
            store_capacity = pd.DataFrame()

            capacity_col = 'e_nom_opt' if 'e_nom_opt' in self.n.stores.columns else 'e_nom'

            store_capacity['Energy_Capacity_MWh'] = self.n.stores.groupby('carrier')[capacity_col].sum()
            store_capacity['Count'] = self.n.stores.groupby('carrier').size()
            store_capacity['Technology'] = store_capacity.index

            results['stores'] = store_capacity.reset_index(drop=True)

        # Transmission capacity
        if hasattr(self.n, 'lines') and not self.n.lines.empty:
            line_capacity = pd.DataFrame()
            capacity_col = 's_nom_opt' if 's_nom_opt' in self.n.lines.columns else 's_nom'
            line_capacity['Total_Capacity_MW'] = [self.n.lines[capacity_col].sum()]
            line_capacity['Count'] = [len(self.n.lines)]
            line_capacity['Total_Length_km'] = [self.n.lines['length'].sum() if 'length' in self.n.lines.columns else 0]
            results['lines'] = line_capacity

        return results

    # =========================================================================
    # 2. TOTAL ENERGY ANALYSIS
    # =========================================================================

    def get_total_energy(self) -> Dict[str, Any]:
        """Get total energy generation, consumption, and storage."""
        results = {
            'generation': {},
            'consumption': {},
            'storage': {},
            'curtailment': {}
        }

        # Total generation by carrier
        if hasattr(self.n, 'generators_t') and hasattr(self.n.generators_t, 'p'):
            gen_p = self.n.generators_t.p
            if not gen_p.empty:
                # Group by carrier
                total_gen_by_carrier = pd.DataFrame()
                for carrier in self.n.generators.carrier.unique():
                    gens = self.n.generators[self.n.generators.carrier == carrier].index
                    gens_in_data = gens.intersection(gen_p.columns)
                    if len(gens_in_data) > 0:
                        total = gen_p[gens_in_data].sum().sum()
                        total_gen_by_carrier.loc[carrier, 'Total_Generation_MWh'] = total

                results['generation'] = total_gen_by_carrier.to_dict()

        # Total consumption/load
        if hasattr(self.n, 'loads_t'):
            for attr in ['p', 'p_set']:
                if hasattr(self.n.loads_t, attr):
                    load_p = getattr(self.n.loads_t, attr)
                    if not load_p.empty:
                        results['consumption']['Total_Load_MWh'] = load_p.sum().sum()
                        break

        # Storage throughput
        if hasattr(self.n, 'storage_units_t') and hasattr(self.n.storage_units_t, 'p'):
            su_p = self.n.storage_units_t.p
            if not su_p.empty:
                results['storage']['total_discharge_MWh'] = su_p.clip(lower=0).sum().sum()
                results['storage']['total_charge_MWh'] = (-su_p.clip(upper=0)).sum().sum()

        if hasattr(self.n, 'stores_t') and hasattr(self.n.stores_t, 'p'):
            store_p = self.n.stores_t.p
            if not store_p.empty:
                results['storage']['battery_discharge_MWh'] = store_p.clip(lower=0).sum().sum()
                results['storage']['battery_charge_MWh'] = (-store_p.clip(upper=0)).sum().sum()

        return results

    # =========================================================================
    # 3. NET ENERGY & ENERGY MIX
    # =========================================================================

    def get_energy_mix(self) -> pd.DataFrame:
        """Get energy generation mix with percentages."""
        if not hasattr(self.n, 'generators_t') or not hasattr(self.n.generators_t, 'p'):
            return pd.DataFrame()

        gen_p = self.n.generators_t.p
        if gen_p.empty:
            return pd.DataFrame()

        # Calculate total generation by carrier
        energy_mix = []
        total_generation = 0

        for carrier in self.n.generators.carrier.unique():
            gens = self.n.generators[self.n.generators.carrier == carrier].index
            gens_in_data = gens.intersection(gen_p.columns)

            if len(gens_in_data) > 0:
                total = gen_p[gens_in_data].sum().sum()
                energy_mix.append({
                    'Carrier': carrier,
                    'Energy_MWh': total
                })
                total_generation += total

        df = pd.DataFrame(energy_mix)
        if not df.empty and total_generation > 0:
            df['Percentage'] = (df['Energy_MWh'] / total_generation * 100).round(2)
            df['Share'] = (df['Energy_MWh'] / total_generation).round(4)

        return df.sort_values('Energy_MWh', ascending=False)

    # =========================================================================
    # 4. UTILIZATION ANALYSIS
    # =========================================================================

    def get_utilization(self) -> pd.DataFrame:
        """Calculate capacity factors (utilization) for all generators."""
        if not hasattr(self.n, 'generators_t') or not hasattr(self.n.generators_t, 'p'):
            return pd.DataFrame()

        gen_p = self.n.generators_t.p
        if gen_p.empty:
            return pd.DataFrame()

        # Get capacities
        capacity_col = 'p_nom_opt' if 'p_nom_opt' in self.n.generators.columns else 'p_nom'

        utilization_data = []
        n_hours = len(gen_p)

        for carrier in self.n.generators.carrier.unique():
            gens = self.n.generators[self.n.generators.carrier == carrier].index
            gens_in_data = gens.intersection(gen_p.columns)

            if len(gens_in_data) > 0:
                total_generation = gen_p[gens_in_data].sum().sum()
                total_capacity = self.n.generators.loc[gens_in_data, capacity_col].sum()

                if total_capacity > 0:
                    capacity_factor = total_generation / (total_capacity * n_hours)

                    utilization_data.append({
                        'Carrier': carrier,
                        'Capacity_Factor': capacity_factor,
                        'Utilization_%': capacity_factor * 100,
                        'Generation_MWh': total_generation,
                        'Capacity_MW': total_capacity,
                        'Hours': n_hours
                    })

        return pd.DataFrame(utilization_data).sort_values('Capacity_Factor', ascending=False)

    # =========================================================================
    # 5. TRANSMISSION FLOW ANALYSIS
    # =========================================================================

    def get_transmission_flows(self) -> Dict[str, pd.DataFrame]:
        """Get transmission line flows and statistics."""
        results = {}

        # AC lines
        if hasattr(self.n, 'lines_t') and hasattr(self.n.lines_t, 'p0'):
            lines_flow = self.n.lines_t.p0
            if not lines_flow.empty:
                flow_stats = pd.DataFrame({
                    'Line': lines_flow.columns,
                    'Avg_Flow_MW': lines_flow.mean(),
                    'Max_Flow_MW': lines_flow.abs().max(),
                    'Min_Flow_MW': lines_flow.min(),
                    'Total_Energy_MWh': lines_flow.abs().sum()
                })

                # Add capacity and utilization
                if hasattr(self.n, 'lines'):
                    capacity_col = 's_nom_opt' if 's_nom_opt' in self.n.lines.columns else 's_nom'
                    flow_stats['Capacity_MW'] = self.n.lines[capacity_col]
                    flow_stats['Max_Utilization_%'] = (flow_stats['Max_Flow_MW'] / flow_stats['Capacity_MW'] * 100)

                results['ac_lines'] = flow_stats

        # DC links
        if hasattr(self.n, 'links_t') and hasattr(self.n.links_t, 'p0'):
            links_flow = self.n.links_t.p0
            if not links_flow.empty:
                flow_stats = pd.DataFrame({
                    'Link': links_flow.columns,
                    'Avg_Flow_MW': links_flow.mean(),
                    'Max_Flow_MW': links_flow.abs().max(),
                    'Min_Flow_MW': links_flow.min(),
                    'Total_Energy_MWh': links_flow.abs().sum()
                })

                # Add capacity
                if hasattr(self.n, 'links'):
                    capacity_col = 'p_nom_opt' if 'p_nom_opt' in self.n.links.columns else 'p_nom'
                    flow_stats['Capacity_MW'] = self.n.links[capacity_col]
                    flow_stats['Max_Utilization_%'] = (flow_stats['Max_Flow_MW'] / flow_stats['Capacity_MW'] * 100)

                results['dc_links'] = flow_stats

        return results

    # =========================================================================
    # 6. ZONAL CAPACITIES
    # =========================================================================

    def get_total_capacities_zonal(self) -> Dict[str, pd.DataFrame]:
        """Get total capacities by zone/region."""
        results = {}

        if not hasattr(self.n, 'buses') or 'country' not in self.n.buses.columns:
            logger.warning("No zonal information (country column) found in buses")
            return results

        # Generators by zone
        if hasattr(self.n, 'generators') and not self.n.generators.empty:
            # Merge with bus country
            gen_with_zone = self.n.generators.merge(
                self.n.buses[['country']],
                left_on='bus',
                right_index=True
            )

            capacity_col = 'p_nom_opt' if 'p_nom_opt' in gen_with_zone.columns else 'p_nom'

            zonal_capacity = gen_with_zone.groupby(['country', 'carrier'])[capacity_col].sum().unstack(fill_value=0)
            results['generators'] = zonal_capacity

        # Storage by zone
        if hasattr(self.n, 'storage_units') and not self.n.storage_units.empty:
            su_with_zone = self.n.storage_units.merge(
                self.n.buses[['country']],
                left_on='bus',
                right_index=True
            )

            capacity_col = 'p_nom_opt' if 'p_nom_opt' in su_with_zone.columns else 'p_nom'

            zonal_su = su_with_zone.groupby(['country', 'carrier'])[capacity_col].sum().unstack(fill_value=0)
            results['storage_units'] = zonal_su

        return results

    # =========================================================================
    # 7. YEARLY COSTS
    # =========================================================================

    def get_yearly_costs(self) -> pd.DataFrame:
        """Calculate yearly system costs breakdown."""
        costs_data = {
            'Capital_Costs': {},
            'Marginal_Costs': {},
            'Total_Costs': {}
        }

        # Generator capital costs
        if hasattr(self.n, 'generators'):
            if 'capital_cost' in self.n.generators.columns:
                capacity_col = 'p_nom_opt' if 'p_nom_opt' in self.n.generators.columns else 'p_nom'
                gen_cap_cost = (self.n.generators['capital_cost'] * self.n.generators[capacity_col]).groupby(
                    self.n.generators['carrier']
                ).sum()
                costs_data['Capital_Costs']['Generators'] = gen_cap_cost.to_dict()

        # Storage capital costs
        if hasattr(self.n, 'storage_units'):
            if 'capital_cost' in self.n.storage_units.columns:
                capacity_col = 'p_nom_opt' if 'p_nom_opt' in self.n.storage_units.columns else 'p_nom'
                su_cap_cost = (self.n.storage_units['capital_cost'] * self.n.storage_units[capacity_col]).groupby(
                    self.n.storage_units['carrier']
                ).sum()
                costs_data['Capital_Costs']['Storage_Units'] = su_cap_cost.to_dict()

        # Store capital costs
        if hasattr(self.n, 'stores'):
            if 'capital_cost' in self.n.stores.columns:
                capacity_col = 'e_nom_opt' if 'e_nom_opt' in self.n.stores.columns else 'e_nom'
                store_cap_cost = (self.n.stores['capital_cost'] * self.n.stores[capacity_col]).groupby(
                    self.n.stores['carrier']
                ).sum()
                costs_data['Capital_Costs']['Stores'] = store_cap_cost.to_dict()

        # Marginal costs
        if hasattr(self.n, 'generators_t') and hasattr(self.n.generators_t, 'p'):
            if 'marginal_cost' in self.n.generators.columns:
                gen_p = self.n.generators_t.p
                marginal_costs = {}

                for carrier in self.n.generators.carrier.unique():
                    gens = self.n.generators[self.n.generators.carrier == carrier].index
                    gens_in_data = gens.intersection(gen_p.columns)

                    if len(gens_in_data) > 0:
                        for gen in gens_in_data:
                            if gen in self.n.generators.index:
                                mc = self.n.generators.loc[gen, 'marginal_cost']
                                if pd.notna(mc):
                                    cost = (gen_p[gen] * mc).sum()
                                    marginal_costs[carrier] = marginal_costs.get(carrier, 0) + cost

                costs_data['Marginal_Costs'] = marginal_costs

        # Total objective
        if hasattr(self.n, 'objective'):
            costs_data['Total_Objective'] = self.n.objective

        return costs_data

    # =========================================================================
    # 8. ENERGY PRICES (MARGINAL PRICES)
    # =========================================================================

    def get_energy_prices(self) -> Dict[str, pd.DataFrame]:
        """Get marginal prices at all buses."""
        results = {}

        if hasattr(self.n, 'buses_t') and hasattr(self.n.buses_t, 'marginal_price'):
            prices = self.n.buses_t.marginal_price

            if not prices.empty:
                # Price statistics by bus
                price_stats = pd.DataFrame({
                    'Bus': prices.columns,
                    'Avg_Price': prices.mean(),
                    'Max_Price': prices.max(),
                    'Min_Price': prices.min(),
                    'Std_Price': prices.std()
                })

                # Add zone information if available
                if 'country' in self.n.buses.columns:
                    price_stats['Zone'] = self.n.buses.loc[prices.columns, 'country'].values

                results['price_statistics'] = price_stats

                # Price duration curve data
                results['price_timeseries'] = prices

                # Zonal average prices
                if 'country' in self.n.buses.columns:
                    zonal_prices = prices.copy()
                    zonal_prices.columns = self.n.buses.loc[prices.columns, 'country'].values
                    zonal_avg = zonal_prices.groupby(level=0, axis=1).mean()
                    results['zonal_prices'] = zonal_avg

        return results

    # =========================================================================
    # 9. STORAGE OUTPUT ANALYSIS
    # =========================================================================

    def get_storage_output(self) -> Dict[str, Any]:
        """Get detailed storage operation data."""
        results = {
            'storage_units': {},
            'stores': {}
        }

        # Storage Units (Pump storage, etc.)
        if hasattr(self.n, 'storage_units_t'):
            if hasattr(self.n.storage_units_t, 'p'):
                su_p = self.n.storage_units_t.p
                if not su_p.empty:
                    # Separate charge and discharge
                    discharge = su_p.clip(lower=0)
                    charge = -su_p.clip(upper=0)

                    # Statistics by storage unit
                    su_stats = pd.DataFrame({
                        'Storage_Unit': su_p.columns,
                        'Total_Discharge_MWh': discharge.sum(),
                        'Total_Charge_MWh': charge.sum(),
                        'Round_Trip_Efficiency': charge.sum() / discharge.sum() if discharge.sum().sum() > 0 else 0,
                        'Max_Discharge_MW': discharge.max(),
                        'Max_Charge_MW': charge.max(),
                        'Cycles': discharge.sum() / self.n.storage_units.loc[su_p.columns, 'p_nom_opt'] if 'p_nom_opt' in self.n.storage_units.columns else 0
                    })

                    results['storage_units']['statistics'] = su_stats
                    results['storage_units']['discharge_timeseries'] = discharge
                    results['storage_units']['charge_timeseries'] = charge

            # State of charge
            if hasattr(self.n.storage_units_t, 'state_of_charge'):
                soc = self.n.storage_units_t.state_of_charge
                if not soc.empty:
                    results['storage_units']['state_of_charge'] = soc

        # Stores (Battery storage)
        if hasattr(self.n, 'stores_t'):
            if hasattr(self.n.stores_t, 'p'):
                store_p = self.n.stores_t.p
                if not store_p.empty:
                    # Separate charge and discharge
                    discharge = store_p.clip(lower=0)
                    charge = -store_p.clip(upper=0)

                    # Statistics
                    store_stats = pd.DataFrame({
                        'Store': store_p.columns,
                        'Total_Discharge_MWh': discharge.sum(),
                        'Total_Charge_MWh': charge.sum(),
                        'Round_Trip_Efficiency': charge.sum() / discharge.sum() if discharge.sum().sum() > 0 else 0,
                        'Max_Discharge_MW': discharge.max(),
                        'Max_Charge_MW': charge.max()
                    })

                    results['stores']['statistics'] = store_stats
                    results['stores']['discharge_timeseries'] = discharge
                    results['stores']['charge_timeseries'] = charge

            # Energy level
            if hasattr(self.n.stores_t, 'e'):
                energy = self.n.stores_t.e
                if not energy.empty:
                    results['stores']['energy_level'] = energy

        return results

    # =========================================================================
    # 10. PLANT OPERATION ANALYSIS
    # =========================================================================

    def get_plant_operation(self) -> pd.DataFrame:
        """Get detailed operation statistics for each plant/generator."""
        if not hasattr(self.n, 'generators_t') or not hasattr(self.n.generators_t, 'p'):
            return pd.DataFrame()

        gen_p = self.n.generators_t.p
        if gen_p.empty:
            return pd.DataFrame()

        operation_data = []

        for gen in gen_p.columns:
            if gen in self.n.generators.index:
                carrier = self.n.generators.loc[gen, 'carrier']
                bus = self.n.generators.loc[gen, 'bus']

                gen_series = gen_p[gen]

                # Get capacity
                capacity_col = 'p_nom_opt' if 'p_nom_opt' in self.n.generators.columns else 'p_nom'
                capacity = self.n.generators.loc[gen, capacity_col]

                operation_data.append({
                    'Generator': gen,
                    'Carrier': carrier,
                    'Bus': bus,
                    'Capacity_MW': capacity,
                    'Total_Generation_MWh': gen_series.sum(),
                    'Capacity_Factor_%': (gen_series.sum() / (capacity * len(gen_series)) * 100) if capacity > 0 else 0,
                    'Avg_Output_MW': gen_series.mean(),
                    'Max_Output_MW': gen_series.max(),
                    'Hours_Operating': (gen_series > 0).sum(),
                    'Operating_Hours_%': (gen_series > 0).sum() / len(gen_series) * 100
                })

        return pd.DataFrame(operation_data)

    # =========================================================================
    # 11. DAILY DEMAND SUPPLY BALANCE
    # =========================================================================

    def get_daily_demand_supply(self) -> pd.DataFrame:
        """Get daily demand and supply balance."""
        if not hasattr(self.n, 'generators_t') or not hasattr(self.n.generators_t, 'p'):
            return pd.DataFrame()

        gen_p = self.n.generators_t.p
        if gen_p.empty or not hasattr(gen_p.index, 'date'):
            return pd.DataFrame()

        # Daily generation
        daily_gen = gen_p.groupby(gen_p.index.date).sum().sum(axis=1)

        # Daily load
        daily_load = pd.Series()
        if hasattr(self.n, 'loads_t'):
            for attr in ['p', 'p_set']:
                if hasattr(self.n.loads_t, attr):
                    load_p = getattr(self.n.loads_t, attr)
                    if not load_p.empty:
                        daily_load = load_p.groupby(load_p.index.date).sum().sum(axis=1)
                        break

        # Combine
        daily_balance = pd.DataFrame({
            'Date': daily_gen.index,
            'Total_Generation_MWh': daily_gen.values,
            'Total_Load_MWh': daily_load.values if not daily_load.empty else 0,
            'Balance_MWh': daily_gen.values - (daily_load.values if not daily_load.empty else 0)
        })

        return daily_balance

    # =========================================================================
    # 12. ZONAL DAILY DEMAND SUPPLY
    # =========================================================================

    def get_zonal_daily_demand_supply(self) -> Dict[str, pd.DataFrame]:
        """Get daily demand and supply balance by zone."""
        if not hasattr(self.n, 'buses') or 'country' not in self.n.buses.columns:
            logger.warning("No zonal information available")
            return {}

        if not hasattr(self.n, 'generators_t') or not hasattr(self.n.generators_t, 'p'):
            return {}

        gen_p = self.n.generators_t.p
        if gen_p.empty or not hasattr(gen_p.index, 'date'):
            return {}

        results = {}

        # For each zone
        for zone in self.n.buses['country'].unique():
            # Get buses in zone
            zone_buses = self.n.buses[self.n.buses['country'] == zone].index

            # Get generators in zone
            zone_gens = self.n.generators[self.n.generators['bus'].isin(zone_buses)].index
            zone_gens_in_data = zone_gens.intersection(gen_p.columns)

            if len(zone_gens_in_data) > 0:
                # Daily generation in zone
                daily_gen = gen_p[zone_gens_in_data].groupby(gen_p.index.date).sum().sum(axis=1)

                # Daily load in zone
                if hasattr(self.n, 'loads_t'):
                    zone_loads = self.n.loads[self.n.loads['bus'].isin(zone_buses)].index

                    for attr in ['p', 'p_set']:
                        if hasattr(self.n.loads_t, attr):
                            load_p = getattr(self.n.loads_t, attr)
                            if not load_p.empty:
                                zone_loads_in_data = zone_loads.intersection(load_p.columns)
                                if len(zone_loads_in_data) > 0:
                                    daily_load = load_p[zone_loads_in_data].groupby(load_p.index.date).sum().sum(axis=1)

                                    zonal_balance = pd.DataFrame({
                                        'Date': daily_gen.index,
                                        'Generation_MWh': daily_gen.values,
                                        'Load_MWh': daily_load.values,
                                        'Balance_MWh': daily_gen.values - daily_load.values
                                    })

                                    results[zone] = zonal_balance
                                    break

        return results

    # =========================================================================
    # 13. TOTAL EMISSIONS
    # =========================================================================

    def get_total_emissions(self) -> pd.DataFrame:
        """Calculate total CO2 emissions."""
        if not hasattr(self.n, 'generators_t') or not hasattr(self.n.generators_t, 'p'):
            return pd.DataFrame()

        gen_p = self.n.generators_t.p
        if gen_p.empty:
            return pd.DataFrame()

        # Check for emissions data
        if not hasattr(self.n, 'carriers') or 'co2_emissions' not in self.n.carriers.columns:
            logger.warning("No CO2 emissions data in carriers")
            return pd.DataFrame()

        emissions_data = []

        for carrier in self.n.generators.carrier.unique():
            if carrier in self.n.carriers.index:
                emission_rate = self.n.carriers.loc[carrier, 'co2_emissions']

                if pd.notna(emission_rate) and emission_rate > 0:
                    gens = self.n.generators[self.n.generators.carrier == carrier].index
                    gens_in_data = gens.intersection(gen_p.columns)

                    if len(gens_in_data) > 0:
                        total_gen = gen_p[gens_in_data].sum().sum()
                        emissions = total_gen * emission_rate

                        emissions_data.append({
                            'Carrier': carrier,
                            'Generation_MWh': total_gen,
                            'Emission_Rate_tCO2_per_MWh': emission_rate,
                            'Total_Emissions_tCO2': emissions
                        })

        return pd.DataFrame(emissions_data)

    # =========================================================================
    # 14. EMISSION FACTORS
    # =========================================================================

    def get_emission_factors(self) -> pd.DataFrame:
        """Get emission factors for all carriers."""
        if not hasattr(self.n, 'carriers'):
            return pd.DataFrame()

        if 'co2_emissions' in self.n.carriers.columns:
            emission_factors = self.n.carriers[['co2_emissions']].copy()
            emission_factors.columns = ['Emission_Factor_tCO2_per_MWh']
            emission_factors['Carrier'] = emission_factors.index
            return emission_factors.reset_index(drop=True)

        return pd.DataFrame()

    # =========================================================================
    # 15. ZONAL EMISSIONS
    # =========================================================================

    def get_zonal_emissions(self) -> pd.DataFrame:
        """Calculate emissions by zone."""
        if not hasattr(self.n, 'buses') or 'country' not in self.n.buses.columns:
            return pd.DataFrame()

        if not hasattr(self.n, 'generators_t') or not hasattr(self.n.generators_t, 'p'):
            return pd.DataFrame()

        gen_p = self.n.generators_t.p
        if gen_p.empty:
            return pd.DataFrame()

        if not hasattr(self.n, 'carriers') or 'co2_emissions' not in self.n.carriers.columns:
            return pd.DataFrame()

        zonal_emissions = []

        for zone in self.n.buses['country'].unique():
            zone_buses = self.n.buses[self.n.buses['country'] == zone].index
            zone_gens = self.n.generators[self.n.generators['bus'].isin(zone_buses)]

            zone_total_emissions = 0
            zone_total_generation = 0

            for carrier in zone_gens.carrier.unique():
                if carrier in self.n.carriers.index:
                    emission_rate = self.n.carriers.loc[carrier, 'co2_emissions']

                    if pd.notna(emission_rate) and emission_rate > 0:
                        carrier_gens = zone_gens[zone_gens.carrier == carrier].index
                        carrier_gens_in_data = carrier_gens.intersection(gen_p.columns)

                        if len(carrier_gens_in_data) > 0:
                            total_gen = gen_p[carrier_gens_in_data].sum().sum()
                            emissions = total_gen * emission_rate

                            zone_total_emissions += emissions
                            zone_total_generation += total_gen

            if zone_total_generation > 0:
                zonal_emissions.append({
                    'Zone': zone,
                    'Total_Generation_MWh': zone_total_generation,
                    'Total_Emissions_tCO2': zone_total_emissions,
                    'Avg_Emission_Factor_tCO2_per_MWh': zone_total_emissions / zone_total_generation
                })

        return pd.DataFrame(zonal_emissions)

    # =========================================================================
    # COMPREHENSIVE ANALYSIS METHOD
    # =========================================================================

    def run_all_analyses(self) -> Dict[str, Any]:
        """
        Run all analyses and return comprehensive results.

        Features:
        - Executes all analysis methods
        - Comprehensive error handling per analysis
        - Progress logging
        - Memory management with garbage collection hints
        - Performance tracking

        Returns:
            dict: Complete analysis results with metadata
        """
        start_time = datetime.now()
        logger.info("Starting comprehensive PyPSA analysis...")

        results = {
            'network_info': self.inspector.info,
            'analyses': {},
            'errors': []  # Track any errors encountered
        }

        # Define all analyses to run with their configurations
        analyses = [
            ('total_capacities', self.get_total_capacities, {}, 'dict'),
            ('total_energy', self.get_total_energy, {}, 'dict'),
            ('energy_mix', self.get_energy_mix, {}, 'records'),
            ('utilization', self.get_utilization, {}, 'records'),
            ('transmission_flows', self.get_transmission_flows, {}, 'dict'),
            ('total_capacities_zonal', self.get_total_capacities_zonal, {}, 'dict'),
            ('yearly_costs', self.get_yearly_costs, {}, 'dict'),
            ('energy_prices', self.get_energy_prices, {}, 'dict'),
            ('storage_output', self.get_storage_output, {}, 'dict'),
            ('plant_operation', self.get_plant_operation, {}, 'records'),
            ('daily_demand_supply', self.get_daily_demand_supply, {}, 'records'),
            ('zonal_daily_demand_supply', self.get_zonal_daily_demand_supply, {}, 'dict'),
            ('total_emissions', self.get_total_emissions, {}, 'records'),
            ('emission_factors', self.get_emission_factors, {}, 'records'),
            ('zonal_emissions', self.get_zonal_emissions, {}, 'records'),
        ]

        total_analyses = len(analyses)

        for idx, (name, func, kwargs, output_format) in enumerate(analyses, 1):
            try:
                logger.info(f"Running analysis {idx}/{total_analyses}: {name}")
                result = func(**kwargs)

                # Convert DataFrames to dict if needed
                if output_format == 'records' and hasattr(result, 'to_dict'):
                    result = result.to_dict('records')
                elif output_format == 'dict' and isinstance(result, dict):
                    # For nested dicts with DataFrames
                    for key, value in result.items():
                        if hasattr(value, 'to_dict'):
                            result[key] = value.to_dict('records')

                results['analyses'][name] = result

                logger.debug(f"Analysis {name} completed successfully")

            except Exception as e:
                error_msg = f"Error in {name}: {str(e)}"
                logger.error(error_msg, exc_info=True)
                results['errors'].append(error_msg)

                # Set default empty value based on output format
                if output_format == 'records':
                    results['analyses'][name] = []
                else:
                    results['analyses'][name] = {}

            # Periodic garbage collection to free memory
            if idx % 5 == 0:
                gc.collect()

        elapsed_time = (datetime.now() - start_time).total_seconds()
        logger.info(f"Comprehensive analysis complete in {elapsed_time:.2f} seconds! "
                   f"Successful: {total_analyses - len(results['errors'])}/{total_analyses}")

        # Final garbage collection
        gc.collect()

        return results
