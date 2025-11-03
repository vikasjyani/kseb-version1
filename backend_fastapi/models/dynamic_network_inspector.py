"""
Dynamic PyPSA Network Inspector
================================

Inspects PyPSA network files (.nc) and returns metadata about available
components, analyses, and data that can be visualized. This allows the
frontend to dynamically show/hide visualizations based on what's actually
available in each specific network file.

Key Features:
- Detects available components (generators, storage, loads, etc.)
- Identifies available time series data
- Determines which analyses can be performed
- Returns frontend-ready availability metadata
- No analysis performed - just inspection (fast)

Author: KSEB Analytics Team
Date: 2025-10-30
"""

import pypsa
import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Any
from pathlib import Path
import logging

logger = logging.getLogger(__name__)


class DynamicNetworkInspector:
    """
    Inspects PyPSA networks and returns detailed availability information.

    This class performs ONLY inspection, no analysis, making it very fast.
    Perfect for frontend to determine what to display without loading full data.
    """

    def __init__(self, network: pypsa.Network):
        """
        Initialize inspector with a PyPSA network.

        Parameters
        ----------
        network : pypsa.Network
            Loaded PyPSA network object
        """
        self.network = network
        self.n = network

    def get_full_availability(self) -> Dict[str, Any]:
        """
        Get comprehensive availability information.

        Returns
        -------
        dict
            Complete availability metadata including:
            - basic_info: Network name, size, solved status
            - components: Available components and their counts
            - time_series: Available time series data
            - analyses: Which analyses can be performed
            - visualizations: Which visualizations can be shown
        """
        availability = {
            'basic_info': self._get_basic_info(),
            'components': self._get_components_info(),
            'time_series': self._get_time_series_info(),
            'spatial_info': self._get_spatial_info(),
            'available_analyses': self._get_available_analyses(),
            'available_visualizations': self._get_available_visualizations()
        }

        return availability

    def _get_basic_info(self) -> Dict[str, Any]:
        """Get basic network information."""
        n = self.n

        info = {
            'name': getattr(n, 'name', 'Unnamed Network'),
            'is_solved': False,
            'has_objective': False,
            'objective_value': None,
            'solver_status': None
        }

        # Check if network is solved (has optimal dispatch)
        if hasattr(n, 'generators_t') and hasattr(n.generators_t, 'p'):
            if not n.generators_t.p.empty:
                info['is_solved'] = True

        # Check for objective value
        if hasattr(n, 'objective') and n.objective is not None:
            info['has_objective'] = True
            info['objective_value'] = float(n.objective)

        return info

    def _get_components_info(self) -> Dict[str, Any]:
        """Get detailed information about available components."""
        n = self.n
        components = {}

        # List of all possible PyPSA components
        component_types = [
            'buses', 'generators', 'loads', 'storage_units', 'stores',
            'lines', 'links', 'transformers', 'shunt_impedances', 'carriers'
        ]

        for comp_type in component_types:
            if hasattr(n, comp_type):
                df = getattr(n, comp_type)
                if not df.empty:
                    components[comp_type] = {
                        'available': True,
                        'count': len(df),
                        'columns': list(df.columns),
                        'has_time_series': False,
                        'time_series_attributes': []
                    }

                    # Check for time series data
                    ts_attr = f'{comp_type}_t'
                    if hasattr(n, ts_attr):
                        ts_dict = getattr(n, ts_attr)
                        if ts_dict:
                            ts_attrs = []
                            for attr_name, attr_data in ts_dict.items():
                                if hasattr(attr_data, 'empty') and not attr_data.empty:
                                    ts_attrs.append(attr_name)

                            if ts_attrs:
                                components[comp_type]['has_time_series'] = True
                                components[comp_type]['time_series_attributes'] = ts_attrs

                    # Add carrier information for relevant components
                    if 'carrier' in df.columns:
                        components[comp_type]['carriers'] = list(df['carrier'].unique())
                        components[comp_type]['carriers_count'] = len(df['carrier'].unique())

                    # Add bus information
                    if 'bus' in df.columns:
                        components[comp_type]['buses'] = list(df['bus'].unique())
                        components[comp_type]['buses_count'] = len(df['bus'].unique())

        return components

    def _get_time_series_info(self) -> Dict[str, Any]:
        """Get information about temporal resolution and coverage."""
        n = self.n

        time_info = {
            'has_snapshots': False,
            'total_snapshots': 0,
            'is_multi_period': False,
            'time_range': None,
            'years': [],
            'resolution': None,
            'resolution_hours': None
        }

        if not hasattr(n, 'snapshots') or n.snapshots.empty:
            return time_info

        snapshots = n.snapshots
        time_info['has_snapshots'] = True
        time_info['total_snapshots'] = len(snapshots)

        # Check for multi-period
        if isinstance(snapshots, pd.MultiIndex):
            time_info['is_multi_period'] = True
            time_level = snapshots.get_level_values(-1)
        else:
            time_level = snapshots

        # Extract temporal information
        if pd.api.types.is_datetime64_any_dtype(time_level):
            time_info['years'] = sorted([int(y) for y in time_level.year.unique()])

            min_time = time_level.min()
            max_time = time_level.max()
            time_info['time_range'] = {
                'start': min_time.isoformat() if hasattr(min_time, 'isoformat') else str(min_time),
                'end': max_time.isoformat() if hasattr(max_time, 'isoformat') else str(max_time)
            }

            # Estimate time resolution
            if len(time_level) > 1:
                diffs = pd.Series(time_level).diff().dropna()
                if not diffs.empty:
                    mode_diff = diffs.mode()[0]
                    time_info['resolution'] = str(mode_diff)
                    time_info['resolution_hours'] = mode_diff.total_seconds() / 3600

        return time_info

    def _get_spatial_info(self) -> Dict[str, Any]:
        """Get spatial/geographical information."""
        n = self.n

        spatial_info = {
            'has_zones': False,
            'zones': [],
            'zones_count': 0,
            'has_coordinates': False,
            'has_geographical_data': False
        }

        if hasattr(n, 'buses') and not n.buses.empty:
            # Check for zone/country information
            if 'country' in n.buses.columns:
                zones = list(n.buses['country'].unique())
                spatial_info['has_zones'] = True
                spatial_info['zones'] = zones
                spatial_info['zones_count'] = len(zones)
            elif 'zone' in n.buses.columns:
                zones = list(n.buses['zone'].unique())
                spatial_info['has_zones'] = True
                spatial_info['zones'] = zones
                spatial_info['zones_count'] = len(zones)

            # Check for coordinates
            if 'x' in n.buses.columns and 'y' in n.buses.columns:
                spatial_info['has_coordinates'] = True
                spatial_info['has_geographical_data'] = True

        return spatial_info

    def _get_available_analyses(self) -> Dict[str, bool]:
        """
        Determine which analyses can be performed on this network.

        Returns dict with analysis names as keys and availability as boolean values.
        """
        n = self.n
        components = self._get_components_info()

        analyses = {
            # Capacity analyses
            'total_capacities': False,
            'zonal_capacities': False,
            'capacity_factors': False,

            # Energy analyses
            'total_energy': False,
            'energy_mix': False,

            # Operational analyses
            'generation_dispatch': False,
            'plant_operation': False,
            'utilization': False,

            # Storage analyses
            'storage_output': False,
            'storage_state_of_charge': False,

            # Transmission analyses
            'transmission_flows': False,
            'line_loading': False,

            # Economic analyses
            'system_costs': False,
            'energy_prices': False,

            # Environmental analyses
            'emissions': False,
            'emission_factors': False,
            'zonal_emissions': False,

            # Temporal analyses
            'daily_demand_supply': False,
            'zonal_daily_demand_supply': False,
            'hourly_profiles': False,

            # Other analyses
            'curtailment': False,
            'reserves': False
        }

        # Check which analyses are possible based on available data

        # Capacity analyses
        if 'generators' in components:
            analyses['total_capacities'] = True
            if self._get_spatial_info()['has_zones']:
                analyses['zonal_capacities'] = True

        # Generation analyses
        if 'generators' in components and components['generators'].get('has_time_series'):
            analyses['generation_dispatch'] = True
            analyses['energy_mix'] = True
            analyses['plant_operation'] = True
            analyses['utilization'] = True
            analyses['capacity_factors'] = True

            # Check for curtailment analysis (needs p_max_pu)
            if 'p_max_pu' in components['generators'].get('time_series_attributes', []):
                analyses['curtailment'] = True

        # Storage analyses
        if 'storage_units' in components or 'stores' in components:
            if ('storage_units' in components and
                components['storage_units'].get('has_time_series')) or \
               ('stores' in components and
                components['stores'].get('has_time_series')):
                analyses['storage_output'] = True
                analyses['storage_state_of_charge'] = True

        # Transmission analyses
        if 'lines' in components or 'links' in components:
            analyses['transmission_flows'] = True
            if ('lines' in components and
                components['lines'].get('has_time_series')) or \
               ('links' in components and
                components['links'].get('has_time_series')):
                analyses['line_loading'] = True

        # Economic analyses
        if 'generators' in components:
            gen_cols = components['generators'].get('columns', [])
            if 'capital_cost' in gen_cols or 'marginal_cost' in gen_cols:
                analyses['system_costs'] = True

        if 'buses' in components and components['buses'].get('has_time_series'):
            if 'marginal_price' in components['buses'].get('time_series_attributes', []):
                analyses['energy_prices'] = True

        # Emissions analyses
        if 'carriers' in components:
            carrier_cols = components['carriers'].get('columns', [])
            if 'co2_emissions' in carrier_cols:
                analyses['emissions'] = True
                analyses['emission_factors'] = True
                if self._get_spatial_info()['has_zones']:
                    analyses['zonal_emissions'] = True

        # Temporal analyses
        if (analyses['generation_dispatch'] and 'loads' in components and
            components['loads'].get('has_time_series')):
            analyses['daily_demand_supply'] = True
            analyses['hourly_profiles'] = True
            if self._get_spatial_info()['has_zones']:
                analyses['zonal_daily_demand_supply'] = True

        # Energy analysis (basic)
        if 'generators' in components and 'loads' in components:
            analyses['total_energy'] = True

        return analyses

    def _get_available_visualizations(self) -> Dict[str, bool]:
        """
        Determine which visualizations can be shown.

        This maps analyses to frontend visualization components.
        """
        analyses = self._get_available_analyses()

        visualizations = {
            # Capacity visualizations
            'capacity_bar_chart': analyses['total_capacities'],
            'capacity_pie_chart': analyses['total_capacities'],
            'zonal_capacity_map': analyses['zonal_capacities'],

            # Generation visualizations
            'energy_mix_pie': analyses['energy_mix'],
            'energy_mix_stacked_bar': analyses['energy_mix'],
            'generation_timeseries': analyses['generation_dispatch'],
            'capacity_factor_bar': analyses['capacity_factors'],

            # Storage visualizations
            'storage_operation_chart': analyses['storage_output'],
            'storage_soc_timeseries': analyses['storage_state_of_charge'],

            # Transmission visualizations
            'transmission_flow_sankey': analyses['transmission_flows'],
            'line_loading_heatmap': analyses['line_loading'],
            'network_map': self._get_spatial_info()['has_coordinates'],

            # Economic visualizations
            'cost_breakdown_chart': analyses['system_costs'],
            'price_duration_curve': analyses['energy_prices'],
            'price_heatmap': analyses['energy_prices'],

            # Environmental visualizations
            'emissions_bar_chart': analyses['emissions'],
            'zonal_emissions_map': analyses['zonal_emissions'],

            # Temporal visualizations
            'daily_profile_chart': analyses['hourly_profiles'],
            'demand_supply_balance': analyses['daily_demand_supply'],
            'zonal_balance_chart': analyses['zonal_daily_demand_supply'],

            # Operational visualizations
            'plant_operation_table': analyses['plant_operation'],
            'utilization_chart': analyses['utilization'],
            'curtailment_chart': analyses['curtailment']
        }

        return visualizations

    def get_summary(self) -> Dict[str, Any]:
        """
        Get a concise summary of network availability.

        Perfect for quick checks without full details.
        """
        full_info = self.get_full_availability()

        summary = {
            'network_name': full_info['basic_info']['name'],
            'is_solved': full_info['basic_info']['is_solved'],
            'snapshots': full_info['time_series']['total_snapshots'],
            'years': full_info['time_series']['years'],
            'has_generators': 'generators' in full_info['components'],
            'has_storage': any(k in full_info['components'] for k in ['storage_units', 'stores']),
            'has_transmission': any(k in full_info['components'] for k in ['lines', 'links']),
            'has_spatial_data': full_info['spatial_info']['has_zones'],
            'analyses_count': sum(full_info['available_analyses'].values()),
            'visualizations_count': sum(full_info['available_visualizations'].values())
        }

        return summary


def inspect_network_file(filepath: str) -> Dict[str, Any]:
    """
    Convenience function to inspect a network file and return availability.

    Parameters
    ----------
    filepath : str
        Path to .nc network file

    Returns
    -------
    dict
        Full availability information
    """
    import pypsa

    network = pypsa.Network(filepath)
    inspector = DynamicNetworkInspector(network)

    return inspector.get_full_availability()
