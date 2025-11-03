"""
PyPSA Multi-Period Utilities
=============================

Core utility functions for multi-period network handling.
Implements the logic for:
- Multi-period detection via pd.MultiIndex
- Snapshot/time indexing and weights
- Period extraction and per-period network creation
- Period-aware aggregation
"""

import pypsa
import pandas as pd
import numpy as np
import logging
import re
from pathlib import Path
from typing import Dict, List, Optional, Union, Tuple, Any

logger = logging.getLogger(__name__)


# ============================================================================
# SNAPSHOT & TIME INDEX UTILITIES
# ============================================================================

def safe_get_snapshots(n: pypsa.Network) -> pd.Index:
    """
    Get snapshots from network safely.

    Parameters
    ----------
    n : pypsa.Network
        PyPSA network

    Returns
    -------
    pd.Index
        Snapshots index (can be DatetimeIndex or MultiIndex)
    """
    return n.snapshots


def get_period_index(index: pd.Index) -> pd.Series:
    """
    Extract period from index.

    For MultiIndex: returns level 0 (period)
    For DatetimeIndex: returns year from timestamps

    Parameters
    ----------
    index : pd.Index
        Snapshot index

    Returns
    -------
    pd.Series
        Period index (periods or years)
    """
    if isinstance(index, pd.MultiIndex):
        # Multi-period: return first level
        return pd.Series(index.get_level_values(0), index=index)
    elif isinstance(index, pd.DatetimeIndex):
        # Single period: return year
        return pd.Series(index.year, index=index)
    else:
        # Try to convert to datetime and extract year
        try:
            dt_index = pd.to_datetime(index)
            return pd.Series(dt_index.year, index=index)
        except:
            logger.warning(f"Could not extract period from index type: {type(index)}")
            return pd.Series(range(len(index)), index=index)


def get_time_index(index: pd.Index) -> pd.DatetimeIndex:
    """
    Extract time/timestamp level from index.

    For MultiIndex: returns last level (timestamp)
    For DatetimeIndex: returns it directly

    Parameters
    ----------
    index : pd.Index
        Snapshot index

    Returns
    -------
    pd.DatetimeIndex
        Timestamp index
    """
    if isinstance(index, pd.MultiIndex):
        # Multi-period: return last level (timestamp)
        time_level = index.get_level_values(-1)
        if not isinstance(time_level, pd.DatetimeIndex):
            time_level = pd.to_datetime(time_level)
        return time_level
    elif isinstance(index, pd.DatetimeIndex):
        # Already datetime
        return index
    else:
        # Try to convert
        try:
            return pd.to_datetime(index)
        except:
            logger.error(f"Could not convert index to datetime: {type(index)}")
            raise ValueError(f"Index must be DatetimeIndex or MultiIndex with datetime, got {type(index)}")


def get_snapshot_weights(n: pypsa.Network, snapshots_idx: Optional[pd.Index] = None) -> pd.Series:
    """
    Get snapshot weights from network.

    Reads n.snapshot_weightings.objective and reindexes to match snapshots.
    If not present, returns series of ones.

    Parameters
    ----------
    n : pypsa.Network
        PyPSA network
    snapshots_idx : pd.Index, optional
        Specific snapshots to get weights for (defaults to all)

    Returns
    -------
    pd.Series
        Snapshot weights (indexed by snapshots)
    """
    if snapshots_idx is None:
        snapshots_idx = n.snapshots

    # Check if snapshot_weightings exists
    if hasattr(n, 'snapshot_weightings') and 'objective' in n.snapshot_weightings.columns:
        weights = n.snapshot_weightings['objective']
        # Reindex to match snapshots
        weights = weights.reindex(snapshots_idx, fill_value=1.0)
    else:
        # Default: all weights are 1
        weights = pd.Series(1.0, index=snapshots_idx)

    return weights


def is_multi_period(n: pypsa.Network) -> bool:
    """
    Check if network has multi-period structure.

    Parameters
    ----------
    n : pypsa.Network
        PyPSA network

    Returns
    -------
    bool
        True if network snapshots are MultiIndex (multi-period)
    """
    snapshots = safe_get_snapshots(n)
    return isinstance(snapshots, pd.MultiIndex)


def get_periods(n: pypsa.Network) -> List[Any]:
    """
    Get list of periods from network.

    For multi-period: returns list of period values from MultiIndex level 0
    For single period: returns list with single period (year or 0)

    Parameters
    ----------
    n : pypsa.Network
        PyPSA network

    Returns
    -------
    list
        List of periods
    """
    snapshots = safe_get_snapshots(n)

    if isinstance(snapshots, pd.MultiIndex):
        # Multi-period: get unique values from level 0
        return list(snapshots.levels[0])
    elif isinstance(snapshots, pd.DatetimeIndex):
        # Single period: return year from first snapshot
        return [snapshots[0].year]
    else:
        return [0]


# ============================================================================
# PERIOD EXTRACTION & PER-PERIOD NETWORK CREATION
# ============================================================================

def extract_period_networks(network_path: Union[str, Path],
                           output_dir: Optional[Union[str, Path]] = None) -> Dict[Any, str]:
    """
    Extract per-period networks from a multi-period network file.

    Loads the network, checks if multi-period, and creates separate
    .nc files for each period.

    Parameters
    ----------
    network_path : str or Path
        Path to multi-period network file
    output_dir : str or Path, optional
        Directory to save extracted period networks
        If None, saves to same directory as network_path

    Returns
    -------
    dict
        {period: path_to_period_network_file}
        For single-period returns {period: original_path}
    """
    network_path = Path(network_path)

    if output_dir is None:
        output_dir = network_path.parent
    else:
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

    logger.info(f"Loading network from: {network_path}")
    network = pypsa.Network(str(network_path))

    snapshots = safe_get_snapshots(network)

    # Check if multi-period
    if not isinstance(snapshots, pd.MultiIndex):
        logger.info("Network is single-period, no extraction needed")
        # Return original file
        first_year = snapshots[0].year if isinstance(snapshots, pd.DatetimeIndex) else 0
        return {first_year: str(network_path)}

    # Multi-period: extract each period
    logger.info("Network is multi-period, extracting periods...")

    periods = list(snapshots.levels[0])
    period_files = {}

    for period in periods:
        logger.info(f"Extracting period: {period}")

        # Create new network for this period
        period_network = pypsa.Network()

        # Copy static component tables
        for component in network.iterate_components():
            comp_name = component.name
            comp_df = component.df

            if not comp_df.empty:
                # Copy static data
                setattr(period_network, comp_name, comp_df.copy())

        # Copy carriers
        if hasattr(network, 'carriers') and not network.carriers.empty:
            period_network.carriers = network.carriers.copy()

        # Filter snapshots for this period
        period_snapshots = snapshots[snapshots.get_level_values(0) == period]
        # Extract time level only
        period_time = period_snapshots.get_level_values(-1)
        period_network.set_snapshots(period_time)

        # Copy time series data for this period
        for component in network.iterate_components():
            comp_name = component.name

            # Check if has time series
            pnl_name = f"{comp_name}_t"
            if hasattr(network, pnl_name):
                network_pnl = getattr(network, pnl_name)
                period_pnl = {}

                for attr_name, attr_data in network_pnl.items():
                    if isinstance(attr_data, pd.DataFrame) and not attr_data.empty:
                        # Filter to this period's snapshots
                        period_data = attr_data.loc[period_snapshots]
                        # Reset index to time only
                        period_data.index = period_time
                        period_pnl[attr_name] = period_data

                # Set time series data
                if period_pnl:
                    setattr(period_network, pnl_name, period_pnl)

        # Copy snapshot weightings
        if hasattr(network, 'snapshot_weightings'):
            period_weights = network.snapshot_weightings.loc[period_snapshots].copy()
            period_weights.index = period_time
            period_network.snapshot_weightings = period_weights

        # Save period network
        output_file = output_dir / f"{network_path.stem}_period_{period}.nc"
        logger.info(f"Saving period {period} to: {output_file}")
        period_network.export_to_netcdf(str(output_file))

        period_files[period] = str(output_file)

    logger.info(f"Extracted {len(periods)} period networks")
    return period_files


def process_multi_period_network(network_path: Union[str, Path],
                                 output_dir: Optional[Union[str, Path]] = None) -> Dict[Any, pypsa.Network]:
    """
    Process a network file and return dict of networks by period.

    If file is multi-period, extracts per-period networks and loads them.
    If single-period, loads the network directly.

    Parameters
    ----------
    network_path : str or Path
        Path to network file
    output_dir : str or Path, optional
        Directory for extracted period files

    Returns
    -------
    dict
        {period: pypsa.Network}
    """
    # Extract period files
    period_files = extract_period_networks(network_path, output_dir)

    # Load each period network
    networks = {}
    for period, file_path in period_files.items():
        logger.info(f"Loading network for period {period}")
        networks[period] = pypsa.Network(file_path)

    return networks


def process_multi_file_networks(file_paths: List[Union[str, Path]],
                                output_dir: Optional[Union[str, Path]] = None) -> Dict[int, pypsa.Network]:
    """
    Process multiple network files and extract year from filename.

    Expects filenames with patterns like:
    - year_2024.nc
    - 2024_results.nc
    - network_2024.nc

    Parameters
    ----------
    file_paths : list
        List of network file paths
    output_dir : str or Path, optional
        Directory for extracted period files

    Returns
    -------
    dict
        {year: pypsa.Network}
    """
    networks_by_year = {}

    for file_path in file_paths:
        file_path = Path(file_path)

        # Extract year from filename
        year_match = re.search(r'year_(\d{4})|(\d{4})_', file_path.stem)
        if year_match:
            year = int(year_match.group(1) or year_match.group(2))
        else:
            logger.warning(f"Could not extract year from filename: {file_path.name}")
            continue

        logger.info(f"Processing file for year {year}: {file_path.name}")

        # Process this file (may be multi-period itself)
        period_networks = process_multi_period_network(file_path, output_dir)

        # If single period, use the year from filename
        if len(period_networks) == 1:
            networks_by_year[year] = list(period_networks.values())[0]
        else:
            # Multi-period file: use period values as sub-years
            for period, network in period_networks.items():
                networks_by_year[period] = network

    return networks_by_year


# ============================================================================
# PERIOD-AWARE AGGREGATION
# ============================================================================

def get_total_generation_by_period(n: pypsa.Network) -> pd.DataFrame:
    """
    Get total generation by carrier and period.

    Groups generators_t['p'] by carrier, multiplies by snapshot weights,
    and aggregates by period.

    Parameters
    ----------
    n : pypsa.Network
        PyPSA network

    Returns
    -------
    pd.DataFrame
        Columns: Period, Carrier, Generation_MWh
    """
    if not hasattr(n, 'generators_t') or 'p' not in n.generators_t:
        return pd.DataFrame(columns=['Period', 'Carrier', 'Generation_MWh'])

    gen_p = n.generators_t['p'].copy()
    if gen_p.empty:
        return pd.DataFrame(columns=['Period', 'Carrier', 'Generation_MWh'])

    # Get snapshot weights
    weights = get_snapshot_weights(n, gen_p.index)

    # Get period index
    period_idx = get_period_index(gen_p.index)

    # Multiply by weights
    gen_weighted = gen_p.multiply(weights, axis=0)

    # Get carrier mapping
    carrier_map = n.generators['carrier'].to_dict()

    # Aggregate by period and carrier
    results = []
    for gen_name in gen_weighted.columns:
        if gen_name not in carrier_map:
            continue

        carrier = carrier_map[gen_name]
        gen_series = gen_weighted[gen_name]

        # Group by period
        period_totals = gen_series.groupby(period_idx).sum()

        for period, total in period_totals.items():
            results.append({
                'Period': period,
                'Carrier': carrier,
                'Generation_MWh': total
            })

    df = pd.DataFrame(results)

    # Aggregate by period and carrier (in case multiple generators per carrier)
    if not df.empty:
        df = df.groupby(['Period', 'Carrier'], as_index=False)['Generation_MWh'].sum()

    return df


def calculate_co2_emissions(n: pypsa.Network) -> Dict[str, Any]:
    """
    Calculate CO2 emissions by period and carrier.

    Computes emissions = generation * emission_factor * weights,
    then groups by period.

    Parameters
    ----------
    n : pypsa.Network
        PyPSA network

    Returns
    -------
    dict
        {
            'total_by_period': {period: total_emissions},
            'by_carrier_by_period': {period: {carrier: emissions}},
            'emission_factors': {carrier: factor}
        }
    """
    result = {
        'total_by_period': {},
        'by_carrier_by_period': {},
        'emission_factors': {}
    }

    if not hasattr(n, 'generators_t') or 'p' not in n.generators_t:
        return result

    gen_p = n.generators_t['p'].copy()
    if gen_p.empty:
        return result

    # Get emission factors
    if hasattr(n, 'carriers') and 'co2_emissions' in n.carriers.columns:
        carrier_co2 = n.carriers['co2_emissions'].to_dict()
    else:
        carrier_co2 = {}

    result['emission_factors'] = carrier_co2

    # Get snapshot weights and period index
    weights = get_snapshot_weights(n, gen_p.index)
    period_idx = get_period_index(gen_p.index)

    # Calculate emissions for each generator
    carrier_map = n.generators['carrier'].to_dict()

    # Temporary storage for period emissions
    period_emissions = {}

    for gen_name in gen_p.columns:
        if gen_name not in carrier_map:
            continue

        carrier = carrier_map[gen_name]
        co2_factor = carrier_co2.get(carrier, 0)

        if co2_factor == 0:
            continue

        # Calculate emissions: generation * factor * weights
        gen_emissions = gen_p[gen_name] * co2_factor * weights

        # Group by period
        period_totals = gen_emissions.groupby(period_idx).sum()

        for period, total in period_totals.items():
            if period not in period_emissions:
                period_emissions[period] = {}

            if carrier not in period_emissions[period]:
                period_emissions[period][carrier] = 0

            period_emissions[period][carrier] += total

    # Aggregate results
    for period, carrier_dict in period_emissions.items():
        result['by_carrier_by_period'][period] = carrier_dict
        result['total_by_period'][period] = sum(carrier_dict.values())

    return result


def calculate_network_losses(n: pypsa.Network) -> pd.DataFrame:
    """
    Calculate network losses by period.

    Sums line/link losses over snapshots, applies weights,
    and groups by period.

    Parameters
    ----------
    n : pypsa.Network
        PyPSA network

    Returns
    -------
    pd.DataFrame
        Columns: Period, Line_Losses_MWh, Link_Losses_MWh, Total_Losses_MWh
    """
    results = []

    snapshots = safe_get_snapshots(n)
    weights = get_snapshot_weights(n)
    period_idx = get_period_index(snapshots)

    # Line losses
    line_losses = pd.Series(0.0, index=snapshots)
    if hasattr(n, 'lines_t') and 'p0' in n.lines_t:
        p0 = n.lines_t['p0']
        if 'p1' in n.lines_t:
            p1 = n.lines_t['p1']
            # Loss = |p0| + |p1|
            line_losses = (p0.abs() + p1.abs()).sum(axis=1) * weights

    # Link losses
    link_losses = pd.Series(0.0, index=snapshots)
    if hasattr(n, 'links_t') and 'p0' in n.links_t:
        p0 = n.links_t['p0']
        if 'p1' in n.links_t:
            p1 = n.links_t['p1']
            # Loss = |p0| - |p1| (accounting for efficiency)
            link_losses = (p0.abs() - p1.abs()).sum(axis=1) * weights

    # Group by period
    for period in get_periods(n):
        period_mask = period_idx == period

        results.append({
            'Period': period,
            'Line_Losses_MWh': line_losses[period_mask].sum(),
            'Link_Losses_MWh': link_losses[period_mask].sum(),
            'Total_Losses_MWh': line_losses[period_mask].sum() + link_losses[period_mask].sum()
        })

    return pd.DataFrame(results)


# ============================================================================
# COLOR PALETTE & CARRIER MAPPING
# ============================================================================

DEFAULT_COLORS = {
    # Fossil fuels
    'coal': '#000000', 'lignite': '#4B4B4B', 'oil': '#FF4500',
    'gas': '#FF6347', 'OCGT': '#FFA07A', 'CCGT': '#FF6B6B',

    # Nuclear
    'nuclear': '#800080',

    # Renewables
    'solar': '#FFD700', 'pv': '#FFD700',
    'wind': '#ADD8E6', 'onwind': '#ADD8E6', 'offwind': '#87CEEB',
    'hydro': '#0073CF', 'ror': '#3399FF',
    'biomass': '#228B22',

    # Storage
    'phs': '#3399FF', 'battery': '#005B5B', 'hydrogen': '#AFEEEE',

    # Other
    'load': '#000000', 'curtailment': '#FF00FF'
}


def get_color_palette(n: pypsa.Network) -> Dict[str, str]:
    """
    Get color palette for carriers from network.

    Priority:
    1. Colors from n.carriers.color
    2. nice_name mapping if available
    3. DEFAULT_COLORS
    4. Generated colors

    Parameters
    ----------
    n : pypsa.Network
        PyPSA network

    Returns
    -------
    dict
        {carrier: color}
    """
    carrier_colors = {}

    # Get all carriers
    carriers = set()
    if hasattr(n, 'generators') and 'carrier' in n.generators.columns:
        carriers.update(n.generators['carrier'].unique())
    if hasattr(n, 'storage_units') and 'carrier' in n.storage_units.columns:
        carriers.update(n.storage_units['carrier'].unique())
    if hasattr(n, 'stores') and 'carrier' in n.stores.columns:
        carriers.update(n.stores['carrier'].unique())

    # Get colors from network carriers table
    network_colors = {}
    if hasattr(n, 'carriers') and 'color' in n.carriers.columns:
        network_colors = n.carriers['color'].dropna().to_dict()

    # Get nice names
    nice_names = {}
    if hasattr(n, 'carriers') and 'nice_name' in n.carriers.columns:
        nice_names = n.carriers['nice_name'].dropna().to_dict()

    # Assign colors
    for carrier in carriers:
        # 1. Check network colors
        if carrier in network_colors:
            carrier_colors[carrier] = network_colors[carrier]
        # 2. Check nice name mapping
        elif carrier in nice_names and nice_names[carrier] in DEFAULT_COLORS:
            carrier_colors[carrier] = DEFAULT_COLORS[nice_names[carrier]]
        # 3. Check default colors
        elif carrier.lower() in DEFAULT_COLORS:
            carrier_colors[carrier] = DEFAULT_COLORS[carrier.lower()]
        # 4. Generate color
        else:
            import hashlib
            color_hash = hashlib.md5(carrier.encode()).hexdigest()[:6]
            carrier_colors[carrier] = f'#{color_hash}'

    return carrier_colors
