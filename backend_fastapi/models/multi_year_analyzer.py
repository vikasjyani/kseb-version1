"""
Multi-Year PyPSA Network Analyzer
==================================

Analyzes multiple PyPSA networks across years to provide temporal insights.

Features:
- Capacity evolution (additions, retirements)
- Energy mix evolution
- CUF (Capacity Utilization Factor) evolution
- Curtailment tracking
- Cost evolution
- Emissions timeline
- Storage evolution
- Performance metrics
"""

import pypsa
import pandas as pd
import numpy as np
from pathlib import Path
from typing import Dict, List, Any, Optional
import logging

# Import network caching
from network_cache import load_network_cached
from .pypsa_comprehensive_analysis import PyPSASingleNetworkAnalyzer

logger = logging.getLogger(__name__)


class MultiYearPyPSAAnalyzer:
    """
    Analyzer for multi-year PyPSA networks.

    This class handles temporal analysis across multiple yearly networks,
    calculating year-on-year changes, trends, and evolution metrics.
    """

    def __init__(
        self,
        project_path: str,
        scenario_name: str,
        year_mapping: Dict[int, str]
    ):
        """
        Initialize multi-year analyzer.

        Args:
            project_path: Project root path
            scenario_name: Scenario folder name
            year_mapping: Dict mapping years to .nc filenames {2024: '2024.nc', ...}
        """
        self.project_path = Path(project_path)
        self.scenario_name = scenario_name
        self.year_mapping = year_mapping
        self.years = sorted(year_mapping.keys())
        self.networks = {}  # Cached networks {year: network}
        self.base_path = self.project_path / "results" / "pypsa_optimization" / scenario_name

    def load_all_networks(self) -> None:
        """
        Load all yearly networks with caching.

        Networks are loaded using the caching mechanism for performance.
        """
        logger.info(f"Loading {len(self.year_mapping)} networks for multi-year analysis")

        for year, filename in self.year_mapping.items():
            network_path = self.base_path / filename
            try:
                self.networks[year] = load_network_cached(str(network_path))
                logger.info(f"Loaded network for year {year}")
            except Exception as e:
                logger.error(f"Failed to load network for year {year}: {e}")
                raise

        logger.info(f"Successfully loaded {len(self.networks)} networks")

    def load_network_for_year(self, year: int) -> pypsa.Network:
        """
        Load network for a specific year.

        Args:
            year: Year to load

        Returns:
            pypsa.Network: Loaded network
        """
        if year in self.networks:
            return self.networks[year]

        if year not in self.year_mapping:
            raise ValueError(f"Year {year} not available. Available years: {self.years}")

        filename = self.year_mapping[year]
        network_path = self.base_path / filename
        network = load_network_cached(str(network_path))
        self.networks[year] = network

        return network

    # =========================================================================
    # CAPACITY EVOLUTION ANALYSIS
    # =========================================================================

    def calculate_capacity_evolution(self) -> Dict[str, Any]:
        """
        Calculate capacity evolution across years.
        """
        logger.info("Calculating capacity evolution")

        if not self.networks:
            self.load_all_networks()

        evolution = {
            'years': self.years,
            'total_capacity': {},
            'new_capacity': {},
            'retired_capacity': {},
            'net_change': {},
            'carriers': set()
        }

        prev_capacity = None

        for year in self.years:
            network = self.networks[year]
            analyzer = PyPSASingleNetworkAnalyzer(network)

            # Using the single network analyzer to get capacities
            capacities_data = analyzer.get_total_capacities()

            current_capacity = {}
            for component in ['generators', 'storage_units', 'stores']:
                if component in capacities_data:
                    for item in capacities_data[component]:
                        tech = item['Technology']
                        cap = item.get('Capacity_MW', item.get('Power_Capacity_MW', item.get('Energy_Capacity_MWh', 0)))
                        current_capacity[tech] = current_capacity.get(tech, 0) + cap
                        evolution['carriers'].add(tech)

            evolution['total_capacity'][year] = current_capacity

            # Calculate year-on-year changes
            if prev_capacity is not None:
                new_capacity = {}
                retired_capacity = {}
                net_change = {}

                all_carriers = set(current_capacity.keys()) | set(prev_capacity.keys())

                for carrier in all_carriers:
                    current = current_capacity.get(carrier, 0)
                    previous = prev_capacity.get(carrier, 0)
                    diff = current - previous
                    net_change[carrier] = diff
                    if diff > 0:
                        new_capacity[carrier] = diff
                    elif diff < 0:
                        retired_capacity[carrier] = abs(diff)

                evolution['new_capacity'][year] = new_capacity
                evolution['retired_capacity'][year] = retired_capacity
                evolution['net_change'][year] = net_change

            prev_capacity = current_capacity

        evolution['carriers'] = sorted(list(evolution['carriers']))
        logger.info(f"Capacity evolution calculated for {len(self.years)} years")
        return evolution

    # =========================================================================
    # ENERGY MIX EVOLUTION ANALYSIS
    # =========================================================================

    def calculate_energy_mix_evolution(self) -> Dict[str, Any]:
        """
        Calculate energy generation mix evolution.
        """
        logger.info("Calculating energy mix evolution")

        if not self.networks:
            self.load_all_networks()

        energy_mix_data = {
            'years': self.years,
            'energy_mix': {},
            'energy_mix_percent': {},
            'renewable_share': {},
            'total_generation': {},
            'carriers': set()
        }

        for year in self.years:
            network = self.networks[year]
            analyzer = PyPSASingleNetworkAnalyzer(network)

            # Using the single network analyzer to get energy mix
            mix_data = analyzer.get_energy_mix()

            carrier_generation = {row['Carrier']: row['Energy_MWh'] for row in mix_data}
            for carrier in carrier_generation.keys():
                energy_mix_data['carriers'].add(carrier)

            energy_mix_data['energy_mix'][year] = carrier_generation

            total = sum(carrier_generation.values())
            energy_mix_data['total_generation'][year] = total

            if total > 0:
                energy_mix_data['energy_mix_percent'][year] = {k: (v / total * 100) for k, v in carrier_generation.items()}

                # Using the single network analyzer to get renewable share
                renewable_data = analyzer.get_renewable_share()
                energy_mix_data['renewable_share'][year] = renewable_data['renewable_share']
            else:
                energy_mix_data['energy_mix_percent'][year] = {}
                energy_mix_data['renewable_share'][year] = 0

        energy_mix_data['carriers'] = sorted(list(energy_mix_data['carriers']))
        logger.info(f"Energy mix evolution calculated for {len(self.years)} years")
        return energy_mix_data

    # =========================================================================
    # CUF EVOLUTION ANALYSIS
    # =========================================================================

    def calculate_cuf_evolution(self) -> Dict[str, Any]:
        """
        Calculate Capacity Utilization Factor evolution.
        """
        logger.info("Calculating CUF evolution")

        if not self.networks:
            self.load_all_networks()

        cuf_data = {
            'years': self.years,
            'cuf': {},
            'average_cuf': {},
            'carriers': set()
        }

        for year in self.years:
            network = self.networks[year]
            analyzer = PyPSASingleNetworkAnalyzer(network)

            # Using the single network analyzer to get capacity factors
            cf_data = analyzer.get_capacity_factors()

            yearly_cuf = cf_data['by_carrier']
            for carrier in yearly_cuf.keys():
                cuf_data['carriers'].add(carrier)

            for carrier, cuf in yearly_cuf.items():
                if carrier not in cuf_data['cuf']:
                    cuf_data['cuf'][carrier] = {}
                cuf_data['cuf'][carrier][year] = cuf * 100 # Convert to percentage

            if yearly_cuf:
                cuf_data['average_cuf'][year] = np.mean(list(yearly_cuf.values())) * 100

        cuf_data['carriers'] = sorted(list(cuf_data['carriers']))
        logger.info(f"CUF evolution calculated for {len(self.years)} years")
        return cuf_data

    # =========================================================================
    # EMISSIONS EVOLUTION ANALYSIS
    # =========================================================================

    def calculate_emissions_evolution(self) -> Dict[str, Any]:
        """
        Calculate CO2 emissions evolution.
        """
        logger.info("Calculating emissions evolution")

        if not self.networks:
            self.load_all_networks()

        emissions_data = {
            'years': self.years,
            'total_emissions': {},
            'emissions_by_carrier': {},
            'carbon_intensity': {}
        }

        for year in self.years:
            network = self.networks[year]
            analyzer = PyPSASingleNetworkAnalyzer(network)

            # Using the single network analyzer to get emissions data
            emissions = analyzer.get_emissions_tracking()

            emissions_data['total_emissions'][year] = emissions['total_emissions']
            emissions_data['carbon_intensity'][year] = emissions['emission_intensity']

            emissions_by_carrier = {row['carrier']: row['emissions'] for row in emissions['by_carrier']}
            emissions_data['emissions_by_carrier'][year] = emissions_by_carrier

        logger.info(f"Emissions evolution calculated for {len(self.years)} years")
        return emissions_data

    # =========================================================================
    # STORAGE EVOLUTION ANALYSIS
    # =========================================================================

    def calculate_storage_evolution(self) -> Dict[str, Any]:
        """
        Calculate storage capacity and operation evolution.
        """
        logger.info("Calculating storage evolution")

        if not self.networks:
            self.load_all_networks()

        storage_data = {
            'years': self.years,
            'battery_capacity_mw': {},
            'battery_capacity_mwh': {},
            'pumped_hydro_capacity_mw': {},
            'total_storage_energy': {},
            'max_hours': {}
        }

        for year in self.years:
            network = self.networks[year]
            analyzer = PyPSASingleNetworkAnalyzer(network)

            # Get data from both storage_units and stores
            su_data = analyzer.get_storage_units()
            s_data = analyzer.get_stores()

            battery_mw = 0
            battery_mwh = s_data['total_energy_capacity']
            hydro_mw = 0

            for su in su_data['storage_units']:
                carrier = su.get('carrier', '')
                p_nom = su.get('p_nom_opt', su.get('p_nom', 0))
                if 'hydro' in carrier.lower() or 'phs' in carrier.lower():
                    hydro_mw += p_nom
                else:
                    battery_mw += p_nom
                battery_mwh += p_nom * su.get('max_hours', 0)

            storage_data['battery_capacity_mw'][year] = battery_mw
            storage_data['battery_capacity_mwh'][year] = battery_mwh
            storage_data['pumped_hydro_capacity_mw'][year] = hydro_mw
            storage_data['total_storage_energy'][year] = battery_mwh

            if battery_mw > 0:
                storage_data['max_hours'][year] = battery_mwh / battery_mw

        logger.info(f"Storage evolution calculated for {len(self.years)} years")
        return storage_data

    # =========================================================================
    # COST EVOLUTION ANALYSIS
    # =========================================================================

    def calculate_cost_evolution(self) -> Dict[str, Any]:
        """
        Calculate system cost evolution.
        """
        logger.info("Calculating cost evolution")

        if not self.networks:
            self.load_all_networks()

        cost_data = {
            'years': self.years,
            'total_cost': {},
            'capex': {},
            'opex': {},
            'cost_by_carrier': {}
        }

        for year in self.years:
            network = self.networks[year]
            analyzer = PyPSASingleNetworkAnalyzer(network)

            # Using the single network analyzer to get system costs
            costs = analyzer.get_system_costs()

            cost_data['total_cost'][year] = costs['total_cost']
            cost_data['capex'][year] = costs['capex_total']
            cost_data['opex'][year] = costs['opex_total']

            cost_by_carrier = {}
            for item in costs['by_component']:
                carrier = item['carrier']
                cost_by_carrier[carrier] = cost_by_carrier.get(carrier, 0) + item['total']
            cost_data['cost_by_carrier'][year] = cost_by_carrier

        logger.info(f"Cost evolution calculated for {len(self.years)} years")
        return cost_data
