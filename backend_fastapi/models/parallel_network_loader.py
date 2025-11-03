"""
Parallel Network Loader for Multi-Year Scenarios
=================================================

Efficient parallel loading of multiple network files using asyncio and threading.

Author: KSEB Analytics Team
Date: 2025-01-15
"""

import pypsa
import asyncio
import logging
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed
import time

logger = logging.getLogger(__name__)


# ============================================================================
# PARALLEL NETWORK LOADER
# ============================================================================

class ParallelNetworkLoader:
    """
    Parallel loader for multiple PyPSA network files.

    Uses thread pool for I/O-bound network loading operations.
    """

    def __init__(self, max_workers: int = 4):
        """
        Initialize parallel loader.

        Parameters
        ----------
        max_workers : int
            Maximum number of concurrent loading threads
        """
        self.max_workers = max_workers
        logger.info(f"ParallelNetworkLoader initialized with {max_workers} workers")

    def load_network(self, file_path: str) -> Tuple[str, pypsa.Network, float]:
        """
        Load a single network file.

        Parameters
        ----------
        file_path : str
            Path to network file

        Returns
        -------
        tuple
            (file_path, network, load_time)
        """
        start_time = time.time()

        try:
            file_path = Path(file_path)

            if not file_path.exists():
                raise FileNotFoundError(f"Network file not found: {file_path}")

            if file_path.suffix == '.nc':
                network = pypsa.Network(str(file_path))
            elif file_path.suffix == '.h5':
                network = pypsa.Network()
                network.import_from_hdf5(str(file_path))
            else:
                raise ValueError(f"Unsupported file format: {file_path.suffix}")

            load_time = time.time() - start_time
            logger.info(f"Loaded {file_path.name} in {load_time:.2f}s")

            return (str(file_path), network, load_time)

        except Exception as e:
            logger.error(f"Error loading {file_path}: {e}")
            raise

    def load_networks_parallel(self, file_paths: List[str]) -> Dict[str, pypsa.Network]:
        """
        Load multiple networks in parallel using thread pool.

        Parameters
        ----------
        file_paths : list
            List of network file paths

        Returns
        -------
        dict
            Dictionary mapping file paths to loaded networks
        """
        if not file_paths:
            return {}

        start_time = time.time()
        networks = {}
        total_load_time = 0

        logger.info(f"Loading {len(file_paths)} networks in parallel...")

        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            # Submit all loading tasks
            future_to_path = {
                executor.submit(self.load_network, path): path
                for path in file_paths
            }

            # Collect results as they complete
            for future in as_completed(future_to_path):
                try:
                    file_path, network, load_time = future.result()
                    networks[file_path] = network
                    total_load_time += load_time
                except Exception as e:
                    path = future_to_path[future]
                    logger.error(f"Failed to load {path}: {e}")

        total_time = time.time() - start_time
        speedup = total_load_time / total_time if total_time > 0 else 1

        logger.info(
            f"Loaded {len(networks)}/{len(file_paths)} networks in {total_time:.2f}s "
            f"(sequential would take {total_load_time:.2f}s, speedup: {speedup:.2f}x)"
        )

        return networks

    async def load_networks_async(self, file_paths: List[str]) -> Dict[str, pypsa.Network]:
        """
        Load multiple networks asynchronously.

        Parameters
        ----------
        file_paths : list
            List of network file paths

        Returns
        -------
        dict
            Dictionary mapping file paths to loaded networks
        """
        if not file_paths:
            return {}

        start_time = time.time()
        loop = asyncio.get_event_loop()
        networks = {}

        logger.info(f"Loading {len(file_paths)} networks asynchronously...")

        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            tasks = [
                loop.run_in_executor(executor, self.load_network, path)
                for path in file_paths
            ]

            results = await asyncio.gather(*tasks, return_exceptions=True)

            for result in results:
                if isinstance(result, Exception):
                    logger.error(f"Failed to load network: {result}")
                else:
                    file_path, network, load_time = result
                    networks[file_path] = network

        total_time = time.time() - start_time
        logger.info(f"Loaded {len(networks)}/{len(file_paths)} networks in {total_time:.2f}s")

        return networks


# ============================================================================
# MULTI-YEAR NETWORK ANALYZER
# ============================================================================

class MultiYearNetworkAnalyzer:
    """
    Analyzer for multi-year network scenarios with parallel loading.
    """

    def __init__(self, max_workers: int = 4):
        """
        Initialize multi-year analyzer.

        Parameters
        ----------
        max_workers : int
            Maximum number of concurrent loading threads
        """
        self.loader = ParallelNetworkLoader(max_workers)
        self.networks = {}
        self.years = []

    def load_year_networks(self, year_file_mapping: Dict[int, str]) -> Dict[int, pypsa.Network]:
        """
        Load networks for multiple years in parallel.

        Parameters
        ----------
        year_file_mapping : dict
            Dictionary mapping years to file paths {2024: '2024.nc', ...}

        Returns
        -------
        dict
            Dictionary mapping years to loaded networks
        """
        start_time = time.time()

        # Load all networks in parallel
        file_paths = list(year_file_mapping.values())
        networks_by_path = self.loader.load_networks_parallel(file_paths)

        # Map back to years
        self.networks = {}
        for year, file_path in year_file_mapping.items():
            if file_path in networks_by_path:
                self.networks[year] = networks_by_path[file_path]

        self.years = sorted(self.networks.keys())

        load_time = time.time() - start_time
        logger.info(f"Loaded {len(self.networks)} yearly networks in {load_time:.2f}s")

        return self.networks

    async def load_year_networks_async(self, year_file_mapping: Dict[int, str]) -> Dict[int, pypsa.Network]:
        """
        Load networks for multiple years asynchronously.

        Parameters
        ----------
        year_file_mapping : dict
            Dictionary mapping years to file paths

        Returns
        -------
        dict
            Dictionary mapping years to loaded networks
        """
        # Load all networks asynchronously
        file_paths = list(year_file_mapping.values())
        networks_by_path = await self.loader.load_networks_async(file_paths)

        # Map back to years
        self.networks = {}
        for year, file_path in year_file_mapping.items():
            if file_path in networks_by_path:
                self.networks[year] = networks_by_path[file_path]

        self.years = sorted(self.networks.keys())

        return self.networks

    def get_capacity_evolution(self, by_carrier: bool = True) -> Dict[str, any]:
        """
        Get capacity evolution across years.

        Parameters
        ----------
        by_carrier : bool
            Group by carrier

        Returns
        -------
        dict
            Capacity evolution data
        """
        if not self.networks:
            return {}

        from .enhanced_pypsa_analyzer import EnhancedPyPSAAnalyzer

        evolution = {'years': self.years}

        if by_carrier:
            # Get all carriers
            all_carriers = set()
            for network in self.networks.values():
                if hasattr(network, 'generators') and 'carrier' in network.generators.columns:
                    all_carriers.update(network.generators['carrier'].unique())

            # Initialize carrier data
            for carrier in all_carriers:
                evolution[carrier] = []

            # Collect capacity for each year
            for year in self.years:
                network = self.networks[year]
                analyzer = EnhancedPyPSAAnalyzer(network)
                capacities = analyzer.get_generator_capacities(by_carrier=True, optimal=True)

                for carrier in all_carriers:
                    evolution[carrier].append(capacities.get(carrier, 0.0))
        else:
            evolution['total_capacity'] = []
            for year in self.years:
                network = self.networks[year]
                analyzer = EnhancedPyPSAAnalyzer(network)
                capacities = analyzer.get_generator_capacities(by_carrier=False, optimal=True)
                evolution['total_capacity'].append(capacities.sum())

        return evolution

    def get_cost_evolution(self) -> Dict[str, List[float]]:
        """
        Get cost evolution across years.

        Returns
        -------
        dict
            Cost evolution data
        """
        if not self.networks:
            return {}

        from .enhanced_pypsa_analyzer import EnhancedPyPSAAnalyzer

        evolution = {
            'years': self.years,
            'capex': [],
            'opex': [],
            'total': []
        }

        for year in self.years:
            network = self.networks[year]
            analyzer = EnhancedPyPSAAnalyzer(network)
            costs = analyzer.get_system_costs(by_component=False)

            evolution['capex'].append(costs['total'].get('capex', 0.0))
            evolution['opex'].append(costs['total'].get('opex', 0.0))
            evolution['total'].append(costs['total'].get('total', 0.0))

        return evolution

    def get_emissions_evolution(self, by_carrier: bool = False) -> Dict[str, any]:
        """
        Get emissions evolution across years.

        Parameters
        ----------
        by_carrier : bool
            Break down by carrier

        Returns
        -------
        dict
            Emissions evolution data
        """
        if not self.networks:
            return {}

        from .enhanced_pypsa_analyzer import EnhancedPyPSAAnalyzer

        evolution = {'years': self.years}

        if by_carrier:
            # Get all carriers with emissions
            all_carriers = set()
            for network in self.networks.values():
                if hasattr(network, 'carriers') and 'co2_emissions' in network.carriers.columns:
                    emitting = network.carriers[network.carriers['co2_emissions'] > 0].index
                    all_carriers.update(emitting)

            for carrier in all_carriers:
                evolution[carrier] = []

            for year in self.years:
                network = self.networks[year]
                analyzer = EnhancedPyPSAAnalyzer(network)
                emissions = analyzer.get_emissions(by_carrier=True)

                for carrier in all_carriers:
                    evolution[carrier].append(emissions.get(carrier, 0.0))
        else:
            evolution['total_emissions'] = []
            for year in self.years:
                network = self.networks[year]
                analyzer = EnhancedPyPSAAnalyzer(network)
                total_emissions = analyzer.get_emissions(by_carrier=False)
                evolution['total_emissions'].append(total_emissions)

        return evolution
