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

        Returns:
            dict: {
                'years': [2024, 2025, ...],
                'total_capacity': {2024: {...by_carrier}, ...},
                'new_capacity': {2025: {...additions_by_carrier}, ...},
                'retired_capacity': {2025: {...retirements_by_carrier}, ...},
                'net_change': {2025: {...net_by_carrier}, ...},
                'cumulative_additions': {...},
                'carriers': [...]
            }
        """
        logger.info("Calculating capacity evolution")

        # Ensure networks are loaded
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

            # Total capacity by carrier
            current_capacity = {}

            if hasattr(network, 'generators') and not network.generators.empty:
                gens = network.generators

                # Group by carrier
                for carrier in gens['carrier'].unique():
                    carrier_gens = gens[gens['carrier'] == carrier]

                    # Use p_nom_opt if available, else p_nom
                    if 'p_nom_opt' in carrier_gens.columns:
                        total = carrier_gens['p_nom_opt'].sum()
                    else:
                        total = carrier_gens['p_nom'].sum()

                    current_capacity[carrier] = float(total)
                    evolution['carriers'].add(carrier)

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
                    net_change[carrier] = float(diff)

                    if diff > 0:
                        new_capacity[carrier] = float(diff)
                    elif diff < 0:
                        retired_capacity[carrier] = float(abs(diff))

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

        Returns:
            dict: {
                'years': [...],
                'energy_mix': {2024: {'solar': 1000, ...}, ...},
                'energy_mix_percent': {2024: {'solar': 40%, ...}, ...},
                'renewable_share': {2024: 75%, ...},
                'total_generation': {2024: 50000, ...}
            }
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

        renewable_carriers = {'solar', 'wind', 'hydro', 'biomass', 'geothermal'}

        for year in self.years:
            network = self.networks[year]
            carrier_generation = {}

            if (hasattr(network, 'generators_t') and
                hasattr(network.generators_t, 'p') and
                not network.generators_t.p.empty):

                generation = network.generators_t.p

                # Aggregate by carrier
                for gen_name in generation.columns:
                    if gen_name in network.generators.index:
                        carrier = network.generators.loc[gen_name, 'carrier']
                        total = generation[gen_name].sum()

                        carrier_generation[carrier] = carrier_generation.get(carrier, 0) + total
                        energy_mix_data['carriers'].add(carrier)

            # Store absolute values
            energy_mix_data['energy_mix'][year] = {
                k: float(v) for k, v in carrier_generation.items()
            }

            # Calculate total
            total = sum(carrier_generation.values())
            energy_mix_data['total_generation'][year] = float(total)

            # Calculate percentages
            if total > 0:
                energy_mix_data['energy_mix_percent'][year] = {
                    k: float((v / total) * 100) for k, v in carrier_generation.items()
                }

                # Calculate renewable share
                renewable_gen = sum(
                    v for k, v in carrier_generation.items()
                    if k.lower() in renewable_carriers
                )
                energy_mix_data['renewable_share'][year] = float((renewable_gen / total) * 100)
            else:
                energy_mix_data['energy_mix_percent'][year] = {}
                energy_mix_data['renewable_share'][year] = 0.0

        energy_mix_data['carriers'] = sorted(list(energy_mix_data['carriers']))

        logger.info(f"Energy mix evolution calculated for {len(self.years)} years")
        return energy_mix_data

    # =========================================================================
    # CUF EVOLUTION ANALYSIS
    # =========================================================================

    def calculate_cuf_evolution(self) -> Dict[str, Any]:
        """
        Calculate Capacity Utilization Factor evolution.

        CUF = Actual Generation / (Installed Capacity × Hours)

        Returns:
            dict: {
                'years': [...],
                'cuf': {'solar': {2024: 0.18, 2025: 0.19, ...}, ...},
                'average_cuf': {2024: 0.35, ...}
            }
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
            yearly_cuf = {}

            if (hasattr(network, 'generators') and
                hasattr(network, 'generators_t') and
                hasattr(network.generators_t, 'p')):

                for carrier in network.generators['carrier'].unique():
                    carrier_gens = network.generators[network.generators['carrier'] == carrier]
                    cuf_data['carriers'].add(carrier)

                    total_generation = 0
                    total_capacity_hours = 0

                    for gen_name in carrier_gens.index:
                        if gen_name in network.generators_t.p.columns:
                            generation = network.generators_t.p[gen_name].sum()

                            # Get capacity
                            if 'p_nom_opt' in carrier_gens.columns:
                                capacity = carrier_gens.loc[gen_name, 'p_nom_opt']
                            else:
                                capacity = carrier_gens.loc[gen_name, 'p_nom']

                            hours = len(network.snapshots)

                            total_generation += generation
                            total_capacity_hours += capacity * hours

                    # Calculate CUF
                    if total_capacity_hours > 0:
                        yearly_cuf[carrier] = float(total_generation / total_capacity_hours)

            # Store CUF by carrier
            for carrier, cuf in yearly_cuf.items():
                if carrier not in cuf_data['cuf']:
                    cuf_data['cuf'][carrier] = {}
                cuf_data['cuf'][carrier][year] = cuf

            # Calculate average CUF
            if yearly_cuf:
                cuf_data['average_cuf'][year] = float(np.mean(list(yearly_cuf.values())))

        cuf_data['carriers'] = sorted(list(cuf_data['carriers']))

        logger.info(f"CUF evolution calculated for {len(self.years)} years")
        return cuf_data

    # =========================================================================
    # EMISSIONS EVOLUTION ANALYSIS
    # =========================================================================

    def calculate_emissions_evolution(self) -> Dict[str, Any]:
        """
        Calculate CO2 emissions evolution.

        Returns:
            dict: {
                'years': [...],
                'total_emissions': {2024: 50000, ...},
                'emissions_by_carrier': {2024: {'gas': 30000, ...}, ...},
                'carbon_intensity': {2024: 0.5, ...}  # tCO2/MWh
            }
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
            carrier_emissions = {}
            total_emissions = 0

            if (hasattr(network, 'generators') and
                hasattr(network, 'generators_t') and
                hasattr(network.generators_t, 'p')):

                # Get carrier CO2 emissions factors
                co2_factors = {}
                if hasattr(network, 'carriers') and 'co2_emissions' in network.carriers.columns:
                    co2_factors = network.carriers['co2_emissions'].to_dict()

                # Calculate emissions
                for gen_name in network.generators_t.p.columns:
                    if gen_name in network.generators.index:
                        carrier = network.generators.loc[gen_name, 'carrier']
                        generation = network.generators_t.p[gen_name].sum()

                        # Get CO2 factor (default to 0 for renewables)
                        co2_factor = co2_factors.get(carrier, 0)

                        emissions = generation * co2_factor
                        carrier_emissions[carrier] = carrier_emissions.get(carrier, 0) + emissions
                        total_emissions += emissions

            emissions_data['emissions_by_carrier'][year] = {
                k: float(v) for k, v in carrier_emissions.items()
            }
            emissions_data['total_emissions'][year] = float(total_emissions)

            # Calculate carbon intensity
            if (hasattr(network, 'generators_t') and
                hasattr(network.generators_t, 'p')):
                total_gen = network.generators_t.p.sum().sum()
                if total_gen > 0:
                    emissions_data['carbon_intensity'][year] = float(total_emissions / total_gen)

        logger.info(f"Emissions evolution calculated for {len(self.years)} years")
        return emissions_data

    # =========================================================================
    # STORAGE EVOLUTION ANALYSIS
    # =========================================================================

    def calculate_storage_evolution(self) -> Dict[str, Any]:
        """
        Calculate storage capacity and operation evolution.

        Returns:
            dict: {
                'years': [...],
                'battery_capacity_mw': {2024: 500, ...},
                'battery_capacity_mwh': {2024: 2000, ...},
                'pumped_hydro_capacity': {...},
                'max_hours': {2024: 4.0, ...},
                'total_storage_energy': {...}
            }
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

            battery_mw = 0
            battery_mwh = 0
            hydro_mw = 0

            # Storage Units (PHS, CAES - MW-based)
            if hasattr(network, 'storage_units') and not network.storage_units.empty:
                storage = network.storage_units

                for idx, row in storage.iterrows():
                    # Get capacity
                    p_nom = row.get('p_nom_opt', row.get('p_nom', 0))

                    # Classify storage type
                    carrier = row.get('carrier', '')
                    if 'hydro' in carrier.lower() or 'phs' in carrier.lower():
                        hydro_mw += p_nom
                    else:
                        battery_mw += p_nom

                    # Get energy capacity
                    max_hours_val = row.get('max_hours', 0)
                    battery_mwh += p_nom * max_hours_val

            # Stores (Batteries, H2 - MWh-based)
            if hasattr(network, 'stores') and not network.stores.empty:
                stores = network.stores

                for idx, row in stores.iterrows():
                    e_nom = row.get('e_nom_opt', row.get('e_nom', 0))
                    battery_mwh += e_nom

            storage_data['battery_capacity_mw'][year] = float(battery_mw)
            storage_data['battery_capacity_mwh'][year] = float(battery_mwh)
            storage_data['pumped_hydro_capacity_mw'][year] = float(hydro_mw)
            storage_data['total_storage_energy'][year] = float(battery_mwh)

            # Calculate average max hours
            if battery_mw > 0:
                storage_data['max_hours'][year] = float(battery_mwh / battery_mw)

        logger.info(f"Storage evolution calculated for {len(self.years)} years")
        return storage_data

    # =========================================================================
    # COST EVOLUTION ANALYSIS
    # =========================================================================

    def calculate_cost_evolution(self) -> Dict[str, Any]:
        """
        Calculate system cost evolution.

        Returns:
            dict: {
                'years': [...],
                'total_cost': {2024: 50000000, ...},
                'capex': {...},
                'opex': {...},
                'cost_by_carrier': {...}
            }
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
            total_cost = 0
            capex = 0
            opex = 0
            carrier_costs = {}

            # Calculate costs from generators
            if hasattr(network, 'generators') and not network.generators.empty:
                gens = network.generators

                for idx, gen in gens.iterrows():
                    carrier = gen.get('carrier', 'unknown')

                    # Capital costs
                    if 'capital_cost' in gen.index and 'p_nom_opt' in gen.index:
                        gen_capex = gen['capital_cost'] * gen['p_nom_opt']
                        capex += gen_capex
                        carrier_costs[carrier] = carrier_costs.get(carrier, 0) + gen_capex

                    # Operational costs
                    if 'marginal_cost' in gen.index:
                        if (hasattr(network, 'generators_t') and
                            hasattr(network.generators_t, 'p') and
                            idx in network.generators_t.p.columns):

                            generation = network.generators_t.p[idx].sum()
                            gen_opex = gen['marginal_cost'] * generation
                            opex += gen_opex
                            carrier_costs[carrier] = carrier_costs.get(carrier, 0) + gen_opex

            total_cost = capex + opex

            cost_data['total_cost'][year] = float(total_cost)
            cost_data['capex'][year] = float(capex)
            cost_data['opex'][year] = float(opex)
            cost_data['cost_by_carrier'][year] = {
                k: float(v) for k, v in carrier_costs.items()
            }

        logger.info(f"Cost evolution calculated for {len(self.years)} years")
        return cost_data
