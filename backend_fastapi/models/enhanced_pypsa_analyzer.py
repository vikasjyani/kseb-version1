"""
Enhanced PyPSA Network Analyzer with Lazy Execution
==================================================

Comprehensive analysis system with on-demand computation and caching.
Supports both single network and multi-period scenarios.

Author: KSEB Analytics Team
Date: 2025-01-15
"""

import pypsa
import pandas as pd
import numpy as np
import logging
from typing import Dict, List, Optional, Tuple, Any, Union, Callable
from pathlib import Path
from dataclasses import dataclass, field
from datetime import datetime
from functools import lru_cache
import time

logger = logging.getLogger(__name__)


# ============================================================================
# ENHANCED ANALYZER WITH LAZY EXECUTION
# ============================================================================

class EnhancedPyPSAAnalyzer:
    """
    Enhanced analyzer with lazy execution and result caching.

    Features:
    - On-demand computation: Only calculate what's requested
    - Result caching: Cache computed results within instance
    - Multi-period support: Handle both single and multi-period networks
    - Comprehensive component analysis: All PyPSA components supported
    """

    def __init__(self, network: pypsa.Network):
        """
        Initialize analyzer with network.

        Parameters
        ----------
        network : pypsa.Network
            PyPSA network to analyze
        """
        self.network = network
        self.n = network  # Short alias

        # Cache dictionaries for computed results
        self._cache = {}
        self._computation_times = {}

        # Network metadata
        self._is_solved = None
        self._is_multi_period = None

        logger.info(f"EnhancedPyPSAAnalyzer initialized for network with {len(network.snapshots)} snapshots")

    # ========================================================================
    # LAZY PROPERTY METHODS
    # ========================================================================

    @property
    def is_solved(self) -> bool:
        """Check if network has been solved (optimization results exist)."""
        if self._is_solved is None:
            self._is_solved = (
                hasattr(self.n, 'generators_t') and
                hasattr(self.n.generators_t, 'p') and
                not self.n.generators_t.p.empty
            )
        return self._is_solved

    @property
    def is_multi_period(self) -> bool:
        """Check if network has multi-period structure (MultiIndex snapshots)."""
        if self._is_multi_period is None:
            self._is_multi_period = isinstance(self.n.snapshots, pd.MultiIndex)
        return self._is_multi_period

    # ========================================================================
    # CACHE MANAGEMENT
    # ========================================================================

    def _get_cached(self, key: str) -> Optional[Any]:
        """Get cached result if available."""
        return self._cache.get(key)

    def _set_cache(self, key: str, value: Any, computation_time: float = None):
        """Store result in cache."""
        self._cache[key] = value
        if computation_time is not None:
            self._computation_times[key] = computation_time

    def clear_cache(self):
        """Clear all cached results."""
        self._cache.clear()
        self._computation_times.clear()
        logger.info("Cache cleared")

    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        return {
            'cached_items': len(self._cache),
            'cache_keys': list(self._cache.keys()),
            'computation_times': self._computation_times.copy()
        }

    # ========================================================================
    # LAZY ANALYSIS METHODS - GENERATORS
    # ========================================================================

    def get_generator_capacities(self, by_carrier: bool = True,
                                 optimal: bool = True) -> Union[pd.Series, Dict[str, float]]:
        """
        Get generator capacities with lazy execution.

        Parameters
        ----------
        by_carrier : bool
            Group by carrier
        optimal : bool
            Use optimal capacity (p_nom_opt) if available

        Returns
        -------
        pd.Series or dict
            Capacities in MW
        """
        cache_key = f"gen_capacity_carrier{by_carrier}_opt{optimal}"

        # Check cache
        cached = self._get_cached(cache_key)
        if cached is not None:
            return cached

        # Compute
        start_time = time.time()

        if not hasattr(self.n, 'generators') or self.n.generators.empty:
            result = pd.Series(dtype=float) if not by_carrier else {}
            self._set_cache(cache_key, result, time.time() - start_time)
            return result

        gens = self.n.generators
        cap_col = 'p_nom_opt' if optimal and 'p_nom_opt' in gens.columns else 'p_nom'

        if by_carrier and 'carrier' in gens.columns:
            result = gens.groupby('carrier')[cap_col].sum().to_dict()
        else:
            result = gens[cap_col]

        computation_time = time.time() - start_time
        self._set_cache(cache_key, result, computation_time)
        logger.debug(f"Computed {cache_key} in {computation_time:.3f}s")

        return result

    def get_generator_generation(self, by_carrier: bool = True,
                                aggregate: str = 'sum') -> Union[pd.DataFrame, Dict[str, float]]:
        """
        Get generator generation time series with lazy execution.

        Parameters
        ----------
        by_carrier : bool
            Group by carrier
        aggregate : str
            Aggregation method: 'sum', 'mean', 'max'

        Returns
        -------
        pd.DataFrame or dict
            Generation in MWh or MW
        """
        cache_key = f"gen_generation_carrier{by_carrier}_agg{aggregate}"

        # Check cache
        cached = self._get_cached(cache_key)
        if cached is not None:
            return cached

        # Compute
        start_time = time.time()

        if not self.is_solved:
            result = pd.DataFrame() if not aggregate else {}
            self._set_cache(cache_key, result, time.time() - start_time)
            return result

        gen_p = self.n.generators_t.p
        gens = self.n.generators

        if by_carrier and 'carrier' in gens.columns:
            # Aggregate by carrier
            gen_by_carrier = pd.DataFrame()
            for carrier in gens['carrier'].unique():
                carrier_gens = gens[gens['carrier'] == carrier].index
                cols = gen_p.columns.intersection(carrier_gens)
                if len(cols) > 0:
                    gen_by_carrier[carrier] = gen_p[cols].sum(axis=1)

            if aggregate == 'sum':
                result = gen_by_carrier.sum().to_dict()
            elif aggregate == 'mean':
                result = gen_by_carrier.mean().to_dict()
            elif aggregate == 'max':
                result = gen_by_carrier.max().to_dict()
            else:
                result = gen_by_carrier
        else:
            result = gen_p

        computation_time = time.time() - start_time
        self._set_cache(cache_key, result, computation_time)
        logger.debug(f"Computed {cache_key} in {computation_time:.3f}s")

        return result

    def get_capacity_factors(self, by_carrier: bool = True) -> Dict[str, float]:
        """
        Calculate capacity factors with lazy execution.

        Parameters
        ----------
        by_carrier : bool
            Group by carrier

        Returns
        -------
        dict
            Capacity factors (0-1)
        """
        cache_key = f"capacity_factors_carrier{by_carrier}"

        # Check cache
        cached = self._get_cached(cache_key)
        if cached is not None:
            return cached

        # Compute
        start_time = time.time()

        if not self.is_solved:
            result = {}
            self._set_cache(cache_key, result, time.time() - start_time)
            return result

        gen_p = self.n.generators_t.p
        gens = self.n.generators
        p_nom_col = 'p_nom_opt' if 'p_nom_opt' in gens.columns else 'p_nom'

        cf_by_carrier = {}

        if by_carrier and 'carrier' in gens.columns:
            for carrier in gens['carrier'].unique():
                carrier_gens = gens[gens['carrier'] == carrier].index
                cols = gen_p.columns.intersection(carrier_gens)

                if len(cols) > 0:
                    total_generation = gen_p[cols].sum().sum()
                    total_capacity = gens.loc[cols, p_nom_col].sum()
                    n_hours = len(gen_p)

                    if total_capacity > 0:
                        cf_by_carrier[carrier] = total_generation / (total_capacity * n_hours)

        computation_time = time.time() - start_time
        self._set_cache(cache_key, cf_by_carrier, computation_time)
        logger.debug(f"Computed {cache_key} in {computation_time:.3f}s")

        return cf_by_carrier

    # ========================================================================
    # LAZY ANALYSIS METHODS - LOADS
    # ========================================================================

    def get_load_demand(self, aggregate: str = 'sum') -> Union[float, pd.Series]:
        """
        Get load demand with lazy execution.

        Parameters
        ----------
        aggregate : str
            'sum' for total MWh, 'peak' for peak MW, 'series' for time series

        Returns
        -------
        float or pd.Series
            Demand value(s)
        """
        cache_key = f"load_demand_agg{aggregate}"

        # Check cache
        cached = self._get_cached(cache_key)
        if cached is not None:
            return cached

        # Compute
        start_time = time.time()

        if not hasattr(self.n, 'loads_t'):
            result = 0.0 if aggregate != 'series' else pd.Series(dtype=float)
            self._set_cache(cache_key, result, time.time() - start_time)
            return result

        load_data = None
        for attr in ['p', 'p_set']:
            if hasattr(self.n.loads_t, attr):
                load_data = getattr(self.n.loads_t, attr).sum(axis=1)
                break

        if load_data is None:
            result = 0.0 if aggregate != 'series' else pd.Series(dtype=float)
            self._set_cache(cache_key, result, time.time() - start_time)
            return result

        if aggregate == 'sum':
            result = load_data.sum()
        elif aggregate == 'peak':
            result = load_data.max()
        elif aggregate == 'series':
            result = load_data
        else:
            result = load_data

        computation_time = time.time() - start_time
        self._set_cache(cache_key, result, computation_time)
        logger.debug(f"Computed {cache_key} in {computation_time:.3f}s")

        return result

    def get_load_factor(self) -> float:
        """Calculate system load factor (average/peak)."""
        cache_key = "load_factor"

        cached = self._get_cached(cache_key)
        if cached is not None:
            return cached

        start_time = time.time()

        load_series = self.get_load_demand('series')
        if load_series.empty:
            result = 0.0
        else:
            peak = load_series.max()
            result = load_series.mean() / peak if peak > 0 else 0.0

        computation_time = time.time() - start_time
        self._set_cache(cache_key, result, computation_time)

        return result

    # ========================================================================
    # LAZY ANALYSIS METHODS - STORAGE
    # ========================================================================

    def get_storage_operation(self, storage_type: str = 'storage_units',
                             by_carrier: bool = True) -> Dict[str, Any]:
        """
        Get storage operation metrics with lazy execution.

        Parameters
        ----------
        storage_type : str
            'storage_units' (PHS - MW-based) or 'stores' (Batteries - MWh-based)
        by_carrier : bool
            Group by carrier

        Returns
        -------
        dict
            Storage operation metrics (charge, discharge, efficiency)
        """
        cache_key = f"storage_op_{storage_type}_carrier{by_carrier}"

        # Check cache
        cached = self._get_cached(cache_key)
        if cached is not None:
            return cached

        # Compute
        start_time = time.time()

        if storage_type == 'storage_units':
            if not hasattr(self.n, 'storage_units') or self.n.storage_units.empty:
                result = {}
                self._set_cache(cache_key, result, time.time() - start_time)
                return result

            storage_df = self.n.storage_units
            storage_t = self.n.storage_units_t if hasattr(self.n, 'storage_units_t') else None
        else:  # stores
            if not hasattr(self.n, 'stores') or self.n.stores.empty:
                result = {}
                self._set_cache(cache_key, result, time.time() - start_time)
                return result

            storage_df = self.n.stores
            storage_t = self.n.stores_t if hasattr(self.n, 'stores_t') else None

        result = {}

        # Power capacity/energy capacity
        if storage_type == 'storage_units':
            cap_col = 'p_nom_opt' if 'p_nom_opt' in storage_df.columns else 'p_nom'
            if by_carrier and 'carrier' in storage_df.columns:
                result['power_capacity_mw'] = storage_df.groupby('carrier')[cap_col].sum().to_dict()
            else:
                result['power_capacity_mw'] = storage_df[cap_col].sum()
        else:  # stores
            cap_col = 'e_nom_opt' if 'e_nom_opt' in storage_df.columns else 'e_nom'
            if by_carrier and 'carrier' in storage_df.columns:
                result['energy_capacity_mwh'] = storage_df.groupby('carrier')[cap_col].sum().to_dict()
            else:
                result['energy_capacity_mwh'] = storage_df[cap_col].sum()

        # Operation metrics
        if storage_t and hasattr(storage_t, 'p') and not storage_t.p.empty:
            storage_p = storage_t.p

            discharge = storage_p.clip(lower=0)
            charge = -storage_p.clip(upper=0)

            if by_carrier and 'carrier' in storage_df.columns:
                result['operation'] = {}
                for carrier in storage_df['carrier'].unique():
                    carrier_storage = storage_df[storage_df['carrier'] == carrier].index
                    cols = storage_p.columns.intersection(carrier_storage)
                    if len(cols) > 0:
                        total_discharge = discharge[cols].sum().sum()
                        total_charge = charge[cols].sum().sum()
                        result['operation'][carrier] = {
                            'discharge_mwh': total_discharge,
                            'charge_mwh': total_charge,
                            'efficiency': total_discharge / total_charge if total_charge > 0 else 0
                        }
            else:
                total_discharge = discharge.sum().sum()
                total_charge = charge.sum().sum()
                result['operation'] = {
                    'discharge_mwh': total_discharge,
                    'charge_mwh': total_charge,
                    'efficiency': total_discharge / total_charge if total_charge > 0 else 0
                }

        computation_time = time.time() - start_time
        self._set_cache(cache_key, result, computation_time)
        logger.debug(f"Computed {cache_key} in {computation_time:.3f}s")

        return result

    # ========================================================================
    # LAZY ANALYSIS METHODS - COSTS
    # ========================================================================

    def get_system_costs(self, by_component: bool = True) -> Dict[str, float]:
        """
        Calculate system costs with lazy execution.

        Parameters
        ----------
        by_component : bool
            Break down by component type

        Returns
        -------
        dict
            Cost breakdown (CAPEX, OPEX, total)
        """
        cache_key = f"system_costs_bycomp{by_component}"

        # Check cache
        cached = self._get_cached(cache_key)
        if cached is not None:
            return cached

        # Compute
        start_time = time.time()

        costs = {'capex': {}, 'opex': {}, 'total': {}}

        # Generators
        if hasattr(self.n, 'generators') and not self.n.generators.empty:
            gens = self.n.generators
            p_nom_col = 'p_nom_opt' if 'p_nom_opt' in gens.columns else 'p_nom'

            if 'capital_cost' in gens.columns:
                gen_capex = (gens['capital_cost'] * gens[p_nom_col]).sum()
                costs['capex']['generators'] = gen_capex

            if 'marginal_cost' in gens.columns and self.is_solved:
                gen_p = self.n.generators_t.p
                gen_opex = sum(
                    (gen_p[gen] * gens.loc[gen, 'marginal_cost']).sum()
                    for gen in gen_p.columns if gen in gens.index
                )
                costs['opex']['generators'] = gen_opex

        # Storage Units
        if hasattr(self.n, 'storage_units') and not self.n.storage_units.empty:
            su = self.n.storage_units
            p_nom_col = 'p_nom_opt' if 'p_nom_opt' in su.columns else 'p_nom'

            if 'capital_cost' in su.columns:
                su_capex = (su['capital_cost'] * su[p_nom_col]).sum()
                costs['capex']['storage_units'] = su_capex

        # Stores
        if hasattr(self.n, 'stores') and not self.n.stores.empty:
            stores = self.n.stores
            e_nom_col = 'e_nom_opt' if 'e_nom_opt' in stores.columns else 'e_nom'

            if 'capital_cost' in stores.columns:
                stores_capex = (stores['capital_cost'] * stores[e_nom_col]).sum()
                costs['capex']['stores'] = stores_capex

        # Lines
        if hasattr(self.n, 'lines') and not self.n.lines.empty:
            lines = self.n.lines
            s_nom_col = 's_nom_opt' if 's_nom_opt' in lines.columns else 's_nom'

            if 'capital_cost' in lines.columns:
                lines_capex = (lines['capital_cost'] * lines[s_nom_col]).sum()
                costs['capex']['lines'] = lines_capex

        # Links
        if hasattr(self.n, 'links') and not self.n.links.empty:
            links = self.n.links
            p_nom_col = 'p_nom_opt' if 'p_nom_opt' in links.columns else 'p_nom'

            if 'capital_cost' in links.columns:
                links_capex = (links['capital_cost'] * links[p_nom_col]).sum()
                costs['capex']['links'] = links_capex

        # Calculate totals
        costs['total']['capex'] = sum(costs['capex'].values())
        costs['total']['opex'] = sum(costs['opex'].values())
        costs['total']['total'] = costs['total']['capex'] + costs['total']['opex']

        computation_time = time.time() - start_time
        self._set_cache(cache_key, costs, computation_time)
        logger.debug(f"Computed {cache_key} in {computation_time:.3f}s")

        return costs

    # ========================================================================
    # LAZY ANALYSIS METHODS - EMISSIONS
    # ========================================================================

    def get_emissions(self, by_carrier: bool = True) -> Union[float, Dict[str, float]]:
        """
        Calculate CO2 emissions with lazy execution.

        Parameters
        ----------
        by_carrier : bool
            Break down by carrier

        Returns
        -------
        float or dict
            Emissions in tons CO2
        """
        cache_key = f"emissions_carrier{by_carrier}"

        # Check cache
        cached = self._get_cached(cache_key)
        if cached is not None:
            return cached

        # Compute
        start_time = time.time()

        if not self.is_solved:
            result = 0.0 if not by_carrier else {}
            self._set_cache(cache_key, result, time.time() - start_time)
            return result

        if not hasattr(self.n, 'carriers') or self.n.carriers.empty:
            result = 0.0 if not by_carrier else {}
            self._set_cache(cache_key, result, time.time() - start_time)
            return result

        carriers = self.n.carriers
        if 'co2_emissions' not in carriers.columns:
            result = 0.0 if not by_carrier else {}
            self._set_cache(cache_key, result, time.time() - start_time)
            return result

        gen_p = self.n.generators_t.p
        gens = self.n.generators

        emissions_by_carrier = {}

        if 'carrier' in gens.columns:
            for carrier in gens['carrier'].unique():
                if carrier in carriers.index:
                    co2_rate = carriers.loc[carrier, 'co2_emissions']
                    if pd.notna(co2_rate) and co2_rate > 0:
                        carrier_gens = gens[gens['carrier'] == carrier].index
                        cols = gen_p.columns.intersection(carrier_gens)
                        if len(cols) > 0:
                            total_generation_mwh = gen_p[cols].sum().sum()
                            emissions_by_carrier[carrier] = total_generation_mwh * co2_rate

        if by_carrier:
            result = emissions_by_carrier
        else:
            result = sum(emissions_by_carrier.values())

        computation_time = time.time() - start_time
        self._set_cache(cache_key, result, computation_time)
        logger.debug(f"Computed {cache_key} in {computation_time:.3f}s")

        return result

    # ========================================================================
    # BATCH ANALYSIS METHOD
    # ========================================================================

    def analyze_batch(self, metrics: List[str], **kwargs) -> Dict[str, Any]:
        """
        Analyze multiple metrics in one call.

        Parameters
        ----------
        metrics : list
            List of metric names to compute
        **kwargs
            Additional parameters for specific metrics

        Returns
        -------
        dict
            Dictionary with all requested metrics
        """
        start_time = time.time()
        results = {}

        for metric in metrics:
            metric_lower = metric.lower()

            try:
                if 'capacity' in metric_lower and 'generator' in metric_lower:
                    results[metric] = self.get_generator_capacities(**kwargs)
                elif 'generation' in metric_lower:
                    results[metric] = self.get_generator_generation(**kwargs)
                elif 'capacity_factor' in metric_lower:
                    results[metric] = self.get_capacity_factors(**kwargs)
                elif 'load' in metric_lower or 'demand' in metric_lower:
                    results[metric] = self.get_load_demand(**kwargs)
                elif 'storage' in metric_lower:
                    storage_type = kwargs.get('storage_type', 'storage_units')
                    results[metric] = self.get_storage_operation(storage_type, **kwargs)
                elif 'cost' in metric_lower:
                    results[metric] = self.get_system_costs(**kwargs)
                elif 'emission' in metric_lower:
                    results[metric] = self.get_emissions(**kwargs)
                elif 'load_factor' in metric_lower:
                    results[metric] = self.get_load_factor()
                else:
                    results[metric] = f"Metric '{metric}' not recognized"
            except Exception as e:
                logger.error(f"Error computing {metric}: {e}")
                results[metric] = {'error': str(e)}

        total_time = time.time() - start_time
        results['_metadata'] = {
            'computation_time': total_time,
            'metrics_computed': len([k for k in results.keys() if k != '_metadata']),
            'cache_hits': sum(1 for k in metrics if self._get_cached(k) is not None)
        }

        logger.info(f"Batch analysis completed in {total_time:.3f}s ({len(metrics)} metrics)")

        return results
