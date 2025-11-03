"""
PyPSA Comprehensive Visualization Routes
========================================

API endpoints for PyPSA network analysis and visualization.

Features:
- Dynamic availability detection
- Network caching for performance
- Input validation
- Comprehensive error handling

Endpoints:
- GET /project/pypsa/scenarios - List available PyPSA scenarios
- GET /project/pypsa/networks - List .nc network files in a scenario
- GET /project/pypsa/availability - Get dynamic availability info (NEW)
- GET /project/pypsa/analyze - Run comprehensive analysis on a network
- GET /project/pypsa/total-capacities - Get total capacities
- GET /project/pypsa/energy-mix - Get energy generation mix
- GET /project/pypsa/utilization - Get capacity factors
- GET /project/pypsa/transmission-flows - Get transmission flows
- GET /project/pypsa/zonal-capacities - Get zonal capacities
- GET /project/pypsa/costs - Get cost breakdown
- GET /project/pypsa/prices - Get energy prices
- GET /project/pypsa/storage-output - Get storage operation
- GET /project/pypsa/plant-operation - Get plant operation statistics
- GET /project/pypsa/daily-demand-supply - Get daily demand-supply balance
- GET /project/pypsa/emissions - Get emissions analysis
- GET /project/pypsa/cache-stats - Get cache statistics (NEW)
- POST /project/pypsa/invalidate-cache - Invalidate cache (NEW)
"""

from fastapi import APIRouter, HTTPException, Query, Body
from pathlib import Path
from typing import List, Dict, Any, Optional
import logging
import json
import re

# Import modules
import sys
sys.path.append(str(Path(__file__).parent.parent / "models"))

from pypsa_comprehensive_analysis import (
    NetworkInspector,
    PyPSAComprehensiveAnalyzer
)
from dynamic_network_inspector import DynamicNetworkInspector
from network_cache import (
    load_network_cached,
    get_cache_stats,
    invalidate_network_cache
)
from multi_year_analyzer import MultiYearPyPSAAnalyzer

logger = logging.getLogger(__name__)
router = APIRouter()


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def find_pypsa_scenarios(project_path: str) -> List[str]:
    """Find all PyPSA scenario folders in the project."""
    pypsa_base = Path(project_path) / "results" / "pypsa_optimization"

    if not pypsa_base.exists():
        return []

    scenarios = []
    for item in pypsa_base.iterdir():
        if item.is_dir():
            scenarios.append(item.name)

    return sorted(scenarios)


def find_network_files(project_path: str, scenario_name: str) -> List[Dict[str, str]]:
    """Find all .nc network files in a scenario folder."""
    scenario_path = Path(project_path) / "results" / "pypsa_optimization" / scenario_name

    if not scenario_path.exists():
        return []

    network_files = []
    for file in scenario_path.glob("*.nc"):
        network_files.append({
            "name": file.name,
            "path": str(file),
            "size_mb": file.stat().st_size / (1024 * 1024)
        })

    return sorted(network_files, key=lambda x: x['name'])


def load_and_analyze_network(network_path: str) -> Dict[str, Any]:
    """Load network and run comprehensive analysis with caching."""
    try:
        # Load network with caching
        network = load_network_cached(network_path)

        # Create analyzer
        analyzer = PyPSAComprehensiveAnalyzer(network)

        # Run all analyses
        results = analyzer.run_all_analyses()

        return results

    except Exception as e:
        logger.error(f"Error analyzing network: {e}")
        raise


def extract_year_from_filename(filename: str) -> Optional[int]:
    """
    Extract year from network filename.

    Supports patterns:
    - 2024.nc
    - network_2024.nc
    - 2024_results.nc
    - year2024.nc
    - elec_2024.nc

    Args:
        filename: Network filename

    Returns:
        int: Year if found, None otherwise
    """
    patterns = [
        r'^(\d{4})\.nc$',           # 2024.nc
        r'_(\d{4})\.nc$',            # network_2024.nc
        r'^(\d{4})_.*\.nc$',         # 2024_results.nc
        r'year(\d{4})\.nc$',         # year2024.nc
        r'elec_(\d{4})\.nc$',        # elec_2024.nc
    ]

    for pattern in patterns:
        match = re.search(pattern, filename, re.IGNORECASE)
        if match:
            year = int(match.group(1))
            # Validate year is in reasonable range
            if 2020 <= year <= 2100:
                return year

    return None


def is_multi_year_scenario(network_files: List[Dict[str, str]]) -> Dict[str, Any]:
    """
    Detect if scenario has multiple yearly networks.

    Args:
        network_files: List of network file info dicts from find_network_files()

    Returns:
        dict: {
            'is_multi_year': bool,
            'years': [2024, 2025, ...],
            'file_mapping': {2024: '2024.nc', 2025: '2025.nc'},
            'type': 'single' | 'multi_year',
            'start_year': int | None,
            'end_year': int | None,
            'count': int
        }
    """
    year_mapping = {}

    for file_info in network_files:
        filename = file_info['name']
        year = extract_year_from_filename(filename)
        if year:
            year_mapping[year] = filename

    years = sorted(year_mapping.keys())

    is_multi = len(years) > 1

    return {
        'is_multi_year': is_multi,
        'years': years,
        'file_mapping': year_mapping,
        'type': 'multi_year' if is_multi else 'single',
        'start_year': years[0] if years else None,
        'end_year': years[-1] if years else None,
        'count': len(years),
        'single_network': network_files[0]['name'] if len(network_files) == 1 and not years else None
    }


# =============================================================================
# API ENDPOINTS
# =============================================================================

@router.get("/pypsa/scenarios")
async def list_pypsa_scenarios(projectPath: str = Query(..., description="Project root path")):
    """
    List all available PyPSA scenarios in the project.

    Returns:
        dict: List of scenario names
    """
    if not projectPath:
        raise HTTPException(status_code=400, detail="Project path is required")

    try:
        scenarios = find_pypsa_scenarios(projectPath)

        return {
            "success": True,
            "scenarios": scenarios,
            "count": len(scenarios)
        }

    except Exception as error:
        logger.error(f"Error listing PyPSA scenarios: {error}")
        raise HTTPException(status_code=500, detail=str(error))


@router.get("/pypsa/networks")
async def list_network_files(
    projectPath: str = Query(..., description="Project root path"),
    scenarioName: str = Query(..., description="Scenario name")
):
    """
    List all .nc network files in a PyPSA scenario.

    Returns:
        dict: List of network files with metadata
    """
    if not projectPath or not scenarioName:
        raise HTTPException(status_code=400, detail="Project path and scenario name are required")

    try:
        network_files = find_network_files(projectPath, scenarioName)

        return {
            "success": True,
            "scenario": scenarioName,
            "networks": network_files,
            "count": len(network_files)
        }

    except Exception as error:
        logger.error(f"Error listing network files: {error}")
        raise HTTPException(status_code=500, detail=str(error))


@router.get("/pypsa/multi-year-info")
async def get_multi_year_info(
    projectPath: str = Query(..., description="Project root path"),
    scenarioName: str = Query(..., description="Scenario name")
):
    """
    Detect if scenario has multi-year networks and return temporal metadata.

    This endpoint analyzes network filenames to detect year patterns and
    determines if the scenario contains multiple yearly networks.

    Supported filename patterns:
    - 2024.nc, 2025.nc
    - network_2024.nc, network_2025.nc
    - 2024_results.nc, 2025_results.nc
    - year2024.nc, year2025.nc
    - elec_2024.nc, elec_2025.nc

    Returns:
        dict: {
            'success': bool,
            'scenario': str,
            'is_multi_year': bool,
            'years': [2024, 2025, ...],
            'file_mapping': {2024: '2024.nc', ...},
            'type': 'single' | 'multi_year',
            'start_year': int | None,
            'end_year': int | None,
            'count': int,
            'networks': List[...],  # All network files
            'single_network': str | None
        }
    """
    if not projectPath or not scenarioName:
        raise HTTPException(status_code=400, detail="Project path and scenario name are required")

    try:
        # Get all network files
        network_files = find_network_files(projectPath, scenarioName)

        if not network_files:
            return {
                "success": True,
                "scenario": scenarioName,
                "is_multi_year": False,
                "years": [],
                "file_mapping": {},
                "type": "empty",
                "start_year": None,
                "end_year": None,
                "count": 0,
                "networks": [],
                "single_network": None
            }

        # Detect multi-year structure
        multi_year_info = is_multi_year_scenario(network_files)

        logger.info(f"Multi-year detection for {scenarioName}: {multi_year_info['type']} "
                   f"({multi_year_info['count']} years)")

        return {
            "success": True,
            "scenario": scenarioName,
            **multi_year_info,
            "networks": network_files  # Include all network files
        }

    except Exception as error:
        logger.error(f"Error detecting multi-year info: {error}")
        raise HTTPException(status_code=500, detail=str(error))


@router.get("/pypsa/availability")
async def get_network_availability(
    projectPath: str = Query(..., description="Project root path"),
    scenarioName: str = Query(..., description="Scenario name"),
    networkFile: str = Query(..., description="Network file name (.nc)")
):
    """
    Get dynamic availability information for a network file.

    This endpoint inspects the network and returns metadata about:
    - Available components (generators, storage, loads, etc.)
    - Available time series data
    - Which analyses can be performed
    - Which visualizations can be shown

    This is a FAST endpoint that only inspects the network structure
    without performing any analysis. Perfect for frontend to determine
    what to display dynamically.

    Returns:
        dict: Comprehensive availability metadata
    """
    if not all([projectPath, scenarioName, networkFile]):
        raise HTTPException(status_code=400, detail="All parameters are required")

    try:
        # Construct network path
        network_path = Path(projectPath) / "results" / "pypsa_optimization" / scenarioName / networkFile

        if not network_path.exists():
            raise HTTPException(status_code=404, detail=f"Network file not found: {networkFile}")

        if network_path.suffix != '.nc':
            raise HTTPException(status_code=400, detail="Only .nc files are supported")

        # Load network with caching
        logger.info(f"Inspecting network availability: {network_path}")
        network = load_network_cached(str(network_path))

        # Create dynamic inspector
        inspector = DynamicNetworkInspector(network)

        # Get full availability information
        availability = inspector.get_full_availability()

        return {
            "success": True,
            "scenario": scenarioName,
            "network_file": networkFile,
            "availability": availability
        }

    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Error getting network availability: {error}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(error))


@router.get("/pypsa/availability/summary")
async def get_network_availability_summary(
    projectPath: str = Query(..., description="Project root path"),
    scenarioName: str = Query(..., description="Scenario name"),
    networkFile: str = Query(..., description="Network file name (.nc)")
):
    """
    Get a concise summary of network availability.

    Faster than full availability check - perfect for quick validations.

    Returns:
        dict: Concise availability summary
    """
    if not all([projectPath, scenarioName, networkFile]):
        raise HTTPException(status_code=400, detail="All parameters are required")

    try:
        # Construct network path
        network_path = Path(projectPath) / "results" / "pypsa_optimization" / scenarioName / networkFile

        if not network_path.exists():
            raise HTTPException(status_code=404, detail=f"Network file not found: {networkFile}")

        # Load network with caching
        network = load_network_cached(str(network_path))

        # Create inspector and get summary
        inspector = DynamicNetworkInspector(network)
        summary = inspector.get_summary()

        return {
            "success": True,
            "scenario": scenarioName,
            "network_file": networkFile,
            "summary": summary
        }

    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Error getting availability summary: {error}")
        raise HTTPException(status_code=500, detail=str(error))


@router.get("/pypsa/cache-stats")
async def get_cache_statistics():
    """
    Get cache performance statistics.

    Returns:
        dict: Cache statistics including hits, misses, hit rate, etc.
    """
    try:
        stats = get_cache_stats()

        return {
            "success": True,
            "cache_stats": stats
        }

    except Exception as error:
        logger.error(f"Error getting cache stats: {error}")
        raise HTTPException(status_code=500, detail=str(error))


@router.post("/pypsa/invalidate-cache")
async def invalidate_cache(
    filepath: Optional[str] = Body(None, description="Specific file to invalidate"),
    clear_all: bool = Body(False, description="Clear entire cache")
):
    """
    Invalidate network cache.

    Use this when network files have been updated and you want to force reload.

    Parameters:
    - filepath: Specific file to invalidate (optional)
    - clear_all: If true, clears entire cache

    Returns:
        dict: Success message
    """
    try:
        if clear_all:
            invalidate_network_cache()
            message = "Entire cache cleared"
        elif filepath:
            invalidate_network_cache(filepath)
            message = f"Cache invalidated for: {filepath}"
        else:
            raise HTTPException(status_code=400, detail="Either filepath or clear_all must be specified")

        return {
            "success": True,
            "message": message
        }

    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Error invalidating cache: {error}")
        raise HTTPException(status_code=500, detail=str(error))


@router.get("/pypsa/analyze")
async def analyze_network(
    projectPath: str = Query(..., description="Project root path"),
    scenarioName: str = Query(..., description="Scenario name"),
    networkFile: str = Query(..., description="Network file name (.nc)")
):
    """
    Run comprehensive analysis on a PyPSA network file.

    This endpoint performs all analyses in one go and returns complete results.

    Returns:
        dict: Comprehensive analysis results including:
            - Network information
            - Total capacities
            - Energy mix
            - Utilization
            - Transmission flows
            - Costs
            - Emissions
            - And more...
    """
    if not all([projectPath, scenarioName, networkFile]):
        raise HTTPException(status_code=400, detail="All parameters are required")

    try:
        # Construct network path
        network_path = Path(projectPath) / "results" / "pypsa_optimization" / scenarioName / networkFile

        if not network_path.exists():
            raise HTTPException(status_code=404, detail=f"Network file not found: {networkFile}")

        if network_path.suffix != '.nc':
            raise HTTPException(status_code=400, detail="Only .nc files are supported")

        # Load and analyze
        logger.info(f"Analyzing network: {network_path}")
        results = load_and_analyze_network(str(network_path))

        return {
            "success": True,
            "scenario": scenarioName,
            "network_file": networkFile,
            "results": results
        }

    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Error analyzing network: {error}")
        raise HTTPException(status_code=500, detail=str(error))


@router.get("/pypsa/total-capacities")
async def get_total_capacities(
    projectPath: str = Query(...),
    scenarioName: str = Query(...),
    networkFile: str = Query(...)
):
    """Get total installed capacities by technology."""
    try:
        network_path = Path(projectPath) / "results" / "pypsa_optimization" / scenarioName / networkFile

        if not network_path.exists():
            raise HTTPException(status_code=404, detail="Network file not found")

        # Use cached network loading
        network = load_network_cached(str(network_path))
        analyzer = PyPSAComprehensiveAnalyzer(network)

        capacities = analyzer.get_total_capacities()

        # Convert DataFrames to dict
        capacities_json = {}
        for key, df in capacities.items():
            if hasattr(df, 'to_dict'):
                capacities_json[key] = df.to_dict('records')
            else:
                capacities_json[key] = df

        return {
            "success": True,
            "capacities": capacities_json
        }

    except Exception as error:
        logger.error(f"Error getting capacities: {error}")
        raise HTTPException(status_code=500, detail=str(error))


@router.get("/pypsa/energy-mix")
async def get_energy_mix(
    projectPath: str = Query(...),
    scenarioName: str = Query(...),
    networkFile: str = Query(...)
):
    """Get energy generation mix with percentages."""
    try:
        network_path = Path(projectPath) / "results" / "pypsa_optimization" / scenarioName / networkFile

        if not network_path.exists():
            raise HTTPException(status_code=404, detail="Network file not found")

        network = load_network_cached(str(network_path))
        analyzer = PyPSAComprehensiveAnalyzer(network)

        energy_mix = analyzer.get_energy_mix()

        return {
            "success": True,
            "energy_mix": energy_mix.to_dict('records') if not energy_mix.empty else []
        }

    except Exception as error:
        logger.error(f"Error getting energy mix: {error}")
        raise HTTPException(status_code=500, detail=str(error))


@router.get("/pypsa/utilization")
async def get_utilization(
    projectPath: str = Query(...),
    scenarioName: str = Query(...),
    networkFile: str = Query(...)
):
    """Get capacity factors (utilization) for all generators."""
    try:
        network_path = Path(projectPath) / "results" / "pypsa_optimization" / scenarioName / networkFile

        if not network_path.exists():
            raise HTTPException(status_code=404, detail="Network file not found")

        network = load_network_cached(str(network_path))
        analyzer = PyPSAComprehensiveAnalyzer(network)

        utilization = analyzer.get_utilization()

        return {
            "success": True,
            "utilization": utilization.to_dict('records') if not utilization.empty else []
        }

    except Exception as error:
        logger.error(f"Error getting utilization: {error}")
        raise HTTPException(status_code=500, detail=str(error))


@router.get("/pypsa/transmission-flows")
async def get_transmission_flows(
    projectPath: str = Query(...),
    scenarioName: str = Query(...),
    networkFile: str = Query(...)
):
    """Get transmission line flows and statistics."""
    try:
        network_path = Path(projectPath) / "results" / "pypsa_optimization" / scenarioName / networkFile

        if not network_path.exists():
            raise HTTPException(status_code=404, detail="Network file not found")

        network = load_network_cached(str(network_path))
        analyzer = PyPSAComprehensiveAnalyzer(network)

        flows = analyzer.get_transmission_flows()

        # Convert DataFrames
        flows_json = {}
        for key, df in flows.items():
            flows_json[key] = df.to_dict('records') if not df.empty else []

        return {
            "success": True,
            "transmission_flows": flows_json
        }

    except Exception as error:
        logger.error(f"Error getting transmission flows: {error}")
        raise HTTPException(status_code=500, detail=str(error))


@router.get("/pypsa/zonal-capacities")
async def get_zonal_capacities(
    projectPath: str = Query(...),
    scenarioName: str = Query(...),
    networkFile: str = Query(...)
):
    """Get total capacities by zone/region."""
    try:
        network_path = Path(projectPath) / "results" / "pypsa_optimization" / scenarioName / networkFile

        if not network_path.exists():
            raise HTTPException(status_code=404, detail="Network file not found")

        network = load_network_cached(str(network_path))
        analyzer = PyPSAComprehensiveAnalyzer(network)

        zonal_capacities = analyzer.get_total_capacities_zonal()

        # Convert DataFrames
        zonal_json = {}
        for key, df in zonal_capacities.items():
            zonal_json[key] = df.to_dict() if not df.empty else {}

        return {
            "success": True,
            "zonal_capacities": zonal_json
        }

    except Exception as error:
        logger.error(f"Error getting zonal capacities: {error}")
        raise HTTPException(status_code=500, detail=str(error))


@router.get("/pypsa/costs")
async def get_costs(
    projectPath: str = Query(...),
    scenarioName: str = Query(...),
    networkFile: str = Query(...)
):
    """Get system cost breakdown."""
    try:
        network_path = Path(projectPath) / "results" / "pypsa_optimization" / scenarioName / networkFile

        if not network_path.exists():
            raise HTTPException(status_code=404, detail="Network file not found")

        network = load_network_cached(str(network_path))
        analyzer = PyPSAComprehensiveAnalyzer(network)

        costs = analyzer.get_yearly_costs()

        return {
            "success": True,
            "costs": costs
        }

    except Exception as error:
        logger.error(f"Error getting costs: {error}")
        raise HTTPException(status_code=500, detail=str(error))


@router.get("/pypsa/prices")
async def get_energy_prices(
    projectPath: str = Query(...),
    scenarioName: str = Query(...),
    networkFile: str = Query(...)
):
    """Get energy prices (marginal prices) at all buses."""
    try:
        network_path = Path(projectPath) / "results" / "pypsa_optimization" / scenarioName / networkFile

        if not network_path.exists():
            raise HTTPException(status_code=404, detail="Network file not found")

        network = load_network_cached(str(network_path))
        analyzer = PyPSAComprehensiveAnalyzer(network)

        prices = analyzer.get_energy_prices()

        # Convert DataFrames to dict (except timeseries - too large)
        prices_json = {}
        for key, value in prices.items():
            if key == 'price_timeseries':
                # For timeseries, just include summary stats
                if hasattr(value, 'describe'):
                    prices_json[f'{key}_summary'] = value.describe().to_dict()
            elif hasattr(value, 'to_dict'):
                prices_json[key] = value.to_dict('records')
            else:
                prices_json[key] = value

        return {
            "success": True,
            "prices": prices_json
        }

    except Exception as error:
        logger.error(f"Error getting prices: {error}")
        raise HTTPException(status_code=500, detail=str(error))


@router.get("/pypsa/storage-output")
async def get_storage_output(
    projectPath: str = Query(...),
    scenarioName: str = Query(...),
    networkFile: str = Query(...)
):
    """
    Get storage operation data.

    Returns separate data for:
    - storage_units: Pump storage and similar (MW capacity, max_hours)
    - stores: Battery storage (MWh capacity)
    """
    try:
        network_path = Path(projectPath) / "results" / "pypsa_optimization" / scenarioName / networkFile

        if not network_path.exists():
            raise HTTPException(status_code=404, detail="Network file not found")

        network = load_network_cached(str(network_path))
        analyzer = PyPSAComprehensiveAnalyzer(network)

        storage_output = analyzer.get_storage_output()

        # Convert DataFrames (exclude large timeseries)
        storage_json = {}
        for storage_type, data in storage_output.items():
            storage_json[storage_type] = {}
            for key, value in data.items():
                if 'timeseries' in key or 'state_of_charge' in key or 'energy_level' in key:
                    # For timeseries, include summary stats only
                    if hasattr(value, 'describe'):
                        storage_json[storage_type][f'{key}_summary'] = value.describe().to_dict()
                elif hasattr(value, 'to_dict'):
                    storage_json[storage_type][key] = value.to_dict('records')
                else:
                    storage_json[storage_type][key] = value

        return {
            "success": True,
            "storage_output": storage_json,
            "note": "storage_units = Pump storage (MW), stores = Battery (MWh)"
        }

    except Exception as error:
        logger.error(f"Error getting storage output: {error}")
        raise HTTPException(status_code=500, detail=str(error))


@router.get("/pypsa/plant-operation")
async def get_plant_operation(
    projectPath: str = Query(...),
    scenarioName: str = Query(...),
    networkFile: str = Query(...)
):
    """Get detailed operation statistics for each plant/generator."""
    try:
        network_path = Path(projectPath) / "results" / "pypsa_optimization" / scenarioName / networkFile

        if not network_path.exists():
            raise HTTPException(status_code=404, detail="Network file not found")

        network = load_network_cached(str(network_path))
        analyzer = PyPSAComprehensiveAnalyzer(network)

        plant_operation = analyzer.get_plant_operation()

        return {
            "success": True,
            "plant_operation": plant_operation.to_dict('records') if not plant_operation.empty else []
        }

    except Exception as error:
        logger.error(f"Error getting plant operation: {error}")
        raise HTTPException(status_code=500, detail=str(error))


@router.get("/pypsa/daily-demand-supply")
async def get_daily_demand_supply(
    projectPath: str = Query(...),
    scenarioName: str = Query(...),
    networkFile: str = Query(...)
):
    """Get daily demand and supply balance."""
    try:
        network_path = Path(projectPath) / "results" / "pypsa_optimization" / scenarioName / networkFile

        if not network_path.exists():
            raise HTTPException(status_code=404, detail="Network file not found")

        network = load_network_cached(str(network_path))
        analyzer = PyPSAComprehensiveAnalyzer(network)

        daily_balance = analyzer.get_daily_demand_supply()

        return {
            "success": True,
            "daily_demand_supply": daily_balance.to_dict('records') if not daily_balance.empty else []
        }

    except Exception as error:
        logger.error(f"Error getting daily demand-supply: {error}")
        raise HTTPException(status_code=500, detail=str(error))


@router.get("/pypsa/zonal-daily-demand-supply")
async def get_zonal_daily_demand_supply(
    projectPath: str = Query(...),
    scenarioName: str = Query(...),
    networkFile: str = Query(...)
):
    """Get daily demand and supply balance by zone."""
    try:
        network_path = Path(projectPath) / "results" / "pypsa_optimization" / scenarioName / networkFile

        if not network_path.exists():
            raise HTTPException(status_code=404, detail="Network file not found")

        network = load_network_cached(str(network_path))
        analyzer = PyPSAComprehensiveAnalyzer(network)

        zonal_balance = analyzer.get_zonal_daily_demand_supply()

        # Convert DataFrames
        zonal_json = {}
        for zone, df in zonal_balance.items():
            zonal_json[zone] = df.to_dict('records') if not df.empty else []

        return {
            "success": True,
            "zonal_daily_demand_supply": zonal_json
        }

    except Exception as error:
        logger.error(f"Error getting zonal daily demand-supply: {error}")
        raise HTTPException(status_code=500, detail=str(error))


@router.get("/pypsa/emissions")
async def get_emissions_analysis(
    projectPath: str = Query(...),
    scenarioName: str = Query(...),
    networkFile: str = Query(...)
):
    """
    Get comprehensive emissions analysis including:
    - Total emissions by carrier
    - Emission factors
    - Zonal emissions
    """
    try:
        network_path = Path(projectPath) / "results" / "pypsa_optimization" / scenarioName / networkFile

        if not network_path.exists():
            raise HTTPException(status_code=404, detail="Network file not found")

        network = load_network_cached(str(network_path))
        analyzer = PyPSAComprehensiveAnalyzer(network)

        # Get all emission-related data
        total_emissions = analyzer.get_total_emissions()
        emission_factors = analyzer.get_emission_factors()
        zonal_emissions = analyzer.get_zonal_emissions()

        return {
            "success": True,
            "emissions": {
                "total_emissions": total_emissions.to_dict('records') if not total_emissions.empty else [],
                "emission_factors": emission_factors.to_dict('records') if not emission_factors.empty else [],
                "zonal_emissions": zonal_emissions.to_dict('records') if not zonal_emissions.empty else []
            }
        }

    except Exception as error:
        logger.error(f"Error getting emissions: {error}")
        raise HTTPException(status_code=500, detail=str(error))


@router.get("/pypsa/network-info")
async def get_network_info(
    projectPath: str = Query(...),
    scenarioName: str = Query(...),
    networkFile: str = Query(...)
):
    """Get basic network information without running full analysis."""
    try:
        network_path = Path(projectPath) / "results" / "pypsa_optimization" / scenarioName / networkFile

        if not network_path.exists():
            raise HTTPException(status_code=404, detail="Network file not found")

        network = load_network_cached(str(network_path))
        inspector = NetworkInspector(network)

        return {
            "success": True,
            "network_info": inspector.info
        }

    except Exception as error:
        logger.error(f"Error getting network info: {error}")
        raise HTTPException(status_code=500, detail=str(error))


# =============================================================================
# MULTI-YEAR ANALYSIS ENDPOINTS
# =============================================================================

@router.get("/pypsa/multi-year/capacity-evolution")
async def get_capacity_evolution(
    projectPath: str = Query(..., description="Project root path"),
    scenarioName: str = Query(..., description="Scenario name"),
    carrier: Optional[str] = Query(None, description="Filter by specific carrier")
):
    """
    Get capacity evolution across years.

    Analyzes year-on-year changes in installed capacity, showing:
    - Total capacity by carrier for each year
    - New capacity additions
    - Retired capacity
    - Net changes

    Args:
        projectPath: Project root path
        scenarioName: Scenario name
        carrier: Optional - filter results for specific carrier

    Returns:
        dict: Capacity evolution data with years, capacities, additions, retirements
    """
    try:
        # Get multi-year info
        network_files = find_network_files(projectPath, scenarioName)
        multi_year_info = is_multi_year_scenario(network_files)

        if not multi_year_info['is_multi_year']:
            raise HTTPException(
                status_code=400,
                detail="Scenario is not multi-year. Multi-year analysis requires multiple yearly network files."
            )

        # Create analyzer
        analyzer = MultiYearPyPSAAnalyzer(
            projectPath,
            scenarioName,
            multi_year_info['file_mapping']
        )

        # Calculate capacity evolution
        evolution = analyzer.calculate_capacity_evolution()

        # Filter by carrier if specified
        if carrier:
            if carrier not in evolution['carriers']:
                raise HTTPException(
                    status_code=404,
                    detail=f"Carrier '{carrier}' not found in networks"
                )

            # Filter data
            for year in evolution['years']:
                for key in ['total_capacity', 'new_capacity', 'retired_capacity', 'net_change']:
                    if year in evolution.get(key, {}):
                        evolution[key][year] = {
                            carrier: evolution[key][year].get(carrier, 0)
                        }

            evolution['carriers'] = [carrier]

        return {
            "success": True,
            "scenario": scenarioName,
            **evolution
        }

    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Error calculating capacity evolution: {error}")
        raise HTTPException(status_code=500, detail=str(error))


@router.get("/pypsa/multi-year/energy-mix-evolution")
async def get_energy_mix_evolution(
    projectPath: str = Query(...),
    scenarioName: str = Query(...)
):
    """
    Get energy generation mix evolution across years.

    Returns:
        dict: Energy mix data including absolute values, percentages, and renewable share
    """
    try:
        network_files = find_network_files(projectPath, scenarioName)
        multi_year_info = is_multi_year_scenario(network_files)

        if not multi_year_info['is_multi_year']:
            raise HTTPException(status_code=400, detail="Scenario is not multi-year")

        analyzer = MultiYearPyPSAAnalyzer(
            projectPath,
            scenarioName,
            multi_year_info['file_mapping']
        )

        energy_mix = analyzer.calculate_energy_mix_evolution()

        return {
            "success": True,
            "scenario": scenarioName,
            **energy_mix
        }

    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Error calculating energy mix evolution: {error}")
        raise HTTPException(status_code=500, detail=str(error))


@router.get("/pypsa/multi-year/cuf-evolution")
async def get_cuf_evolution(
    projectPath: str = Query(...),
    scenarioName: str = Query(...),
    technology: Optional[str] = Query(None, description="Filter by technology/carrier")
):
    """
    Get Capacity Utilization Factor (CUF) evolution.

    CUF = Actual Generation / (Installed Capacity × Hours)

    Returns:
        dict: CUF data by carrier and year
    """
    try:
        network_files = find_network_files(projectPath, scenarioName)
        multi_year_info = is_multi_year_scenario(network_files)

        if not multi_year_info['is_multi_year']:
            raise HTTPException(status_code=400, detail="Scenario is not multi-year")

        analyzer = MultiYearPyPSAAnalyzer(
            projectPath,
            scenarioName,
            multi_year_info['file_mapping']
        )

        cuf_data = analyzer.calculate_cuf_evolution()

        # Filter by technology if specified
        if technology and technology in cuf_data['cuf']:
            cuf_data['cuf'] = {technology: cuf_data['cuf'][technology]}
            cuf_data['carriers'] = [technology]

        return {
            "success": True,
            "scenario": scenarioName,
            **cuf_data
        }

    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Error calculating CUF evolution: {error}")
        raise HTTPException(status_code=500, detail=str(error))


@router.get("/pypsa/multi-year/emissions-evolution")
async def get_emissions_evolution(
    projectPath: str = Query(...),
    scenarioName: str = Query(...)
):
    """
    Get CO2 emissions evolution across years.

    Returns:
        dict: Emissions data including total, by carrier, and carbon intensity
    """
    try:
        network_files = find_network_files(projectPath, scenarioName)
        multi_year_info = is_multi_year_scenario(network_files)

        if not multi_year_info['is_multi_year']:
            raise HTTPException(status_code=400, detail="Scenario is not multi-year")

        analyzer = MultiYearPyPSAAnalyzer(
            projectPath,
            scenarioName,
            multi_year_info['file_mapping']
        )

        emissions = analyzer.calculate_emissions_evolution()

        return {
            "success": True,
            "scenario": scenarioName,
            **emissions
        }

    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Error calculating emissions evolution: {error}")
        raise HTTPException(status_code=500, detail=str(error))


@router.get("/pypsa/multi-year/storage-evolution")
async def get_storage_evolution(
    projectPath: str = Query(...),
    scenarioName: str = Query(...)
):
    """
    Get storage capacity and operation evolution.

    Returns:
        dict: Storage evolution data including battery, pumped hydro, and max hours
    """
    try:
        network_files = find_network_files(projectPath, scenarioName)
        multi_year_info = is_multi_year_scenario(network_files)

        if not multi_year_info['is_multi_year']:
            raise HTTPException(status_code=400, detail="Scenario is not multi-year")

        analyzer = MultiYearPyPSAAnalyzer(
            projectPath,
            scenarioName,
            multi_year_info['file_mapping']
        )

        storage = analyzer.calculate_storage_evolution()

        return {
            "success": True,
            "scenario": scenarioName,
            **storage
        }

    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Error calculating storage evolution: {error}")
        raise HTTPException(status_code=500, detail=str(error))


@router.get("/pypsa/multi-year/cost-evolution")
async def get_cost_evolution(
    projectPath: str = Query(...),
    scenarioName: str = Query(...)
):
    """
    Get system cost evolution across years.

    Returns:
        dict: Cost data including total, CAPEX, OPEX, and breakdown by carrier
    """
    try:
        network_files = find_network_files(projectPath, scenarioName)
        multi_year_info = is_multi_year_scenario(network_files)

        if not multi_year_info['is_multi_year']:
            raise HTTPException(status_code=400, detail="Scenario is not multi-year")

        analyzer = MultiYearPyPSAAnalyzer(
            projectPath,
            scenarioName,
            multi_year_info['file_mapping']
        )

        costs = analyzer.calculate_cost_evolution()

        return {
            "success": True,
            "scenario": scenarioName,
            **costs
        }

    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Error calculating cost evolution: {error}")
        raise HTTPException(status_code=500, detail=str(error))
