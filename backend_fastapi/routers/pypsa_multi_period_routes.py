"""
PyPSA Multi-Period & Multi-File Routes
======================================

API endpoints for handling:
- Single vs multiple .nc files detection
- Multi-period network detection and extraction
- Period-specific analysis
- Multi-file year-by-year analysis
"""

from fastapi import APIRouter, HTTPException, Query, Body
from pathlib import Path
from typing import List, Dict, Any, Optional
import logging
import pypsa

import sys
sys.path.append(str(Path(__file__).parent.parent / "models"))

from pypsa_multi_period_utils import (
    is_multi_period,
    get_periods,
    extract_period_networks,
    process_multi_period_network,
    process_multi_file_networks
)
from network_cache import load_network_cached

logger = logging.getLogger(__name__)
router = APIRouter()


# =============================================================================
# NETWORK DETECTION & METADATA
# =============================================================================

@router.get("/pypsa/detect-network-type")
async def detect_network_type(
    projectPath: str = Query(..., description="Project root path"),
    scenarioName: str = Query(..., description="Scenario folder name")
):
    """
    Detect network type in scenario folder.

    Checks:
    1. How many .nc files are in the folder
    2. If single file, whether it's multi-period
    3. If multiple files, extract years from filenames

    Returns workflow type: 'single-period', 'multi-period', or 'multi-file'
    """
    try:
        scenario_path = Path(projectPath) / "results" / "pypsa_optimization" / scenarioName

        if not scenario_path.exists():
            raise HTTPException(status_code=404, detail=f"Scenario folder not found: {scenarioName}")

        # Find all .nc files
        nc_files = list(scenario_path.glob("*.nc"))

        if len(nc_files) == 0:
            return {
                "success": True,
                "workflow_type": "no_files",
                "message": "No .nc files found in scenario folder",
                "file_count": 0
            }

        elif len(nc_files) == 1:
            # Single file: check if multi-period
            file_path = nc_files[0]
            logger.info(f"Single file detected: {file_path.name}")

            # Load network to check
            network = load_network_cached(str(file_path))

            if is_multi_period(network):
                periods = get_periods(network)

                return {
                    "success": True,
                    "workflow_type": "multi-period",
                    "message": f"Single multi-period network with {len(periods)} periods",
                    "file_count": 1,
                    "file": {
                        "name": file_path.name,
                        "path": str(file_path),
                        "size_mb": round(file_path.stat().st_size / (1024 * 1024), 2)
                    },
                    "periods": periods,
                    "period_count": len(periods),
                    "snapshots_per_period": len(network.snapshots.get_level_values(0).unique())
                }
            else:
                # Single period network
                return {
                    "success": True,
                    "workflow_type": "single-period",
                    "message": "Single-period network",
                    "file_count": 1,
                    "file": {
                        "name": file_path.name,
                        "path": str(file_path),
                        "size_mb": round(file_path.stat().st_size / (1024 * 1024), 2)
                    },
                    "snapshot_count": len(network.snapshots)
                }

        else:
            # Multiple files
            import re

            files_info = []
            years = []

            for file_path in nc_files:
                # Extract year from filename
                year_match = re.search(r'year_(\d{4})|(\d{4})_|(\d{4})', file_path.stem)
                year = None
                if year_match:
                    year = int(year_match.group(1) or year_match.group(2) or year_match.group(3))
                    years.append(year)

                files_info.append({
                    "name": file_path.name,
                    "path": str(file_path),
                    "size_mb": round(file_path.stat().st_size / (1024 * 1024), 2),
                    "year": year
                })

            files_info.sort(key=lambda x: x['year'] if x['year'] else x['name'])

            return {
                "success": True,
                "workflow_type": "multi-file",
                "message": f"Multiple network files ({len(nc_files)} files)",
                "file_count": len(nc_files),
                "files": files_info,
                "years": sorted(years) if years else None,
                "year_range": f"{min(years)}-{max(years)}" if years else None
            }

    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Error detecting network type: {error}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(error))


@router.get("/pypsa/list-periods")
async def list_periods(
    projectPath: str = Query(..., description="Project root path"),
    scenarioName: str = Query(..., description="Scenario folder name"),
    networkFile: str = Query(..., description="Network filename")
):
    """
    List periods available in a network file.

    For multi-period networks: returns list of periods
    For single-period: returns single period (year)
    """
    try:
        network_path = Path(projectPath) / "results" / "pypsa_optimization" / scenarioName / networkFile

        if not network_path.exists():
            raise HTTPException(status_code=404, detail=f"Network file not found: {networkFile}")

        # Load network
        network = load_network_cached(str(network_path))

        # Get periods
        periods = get_periods(network)
        is_mp = is_multi_period(network)

        return {
            "success": True,
            "scenario": scenarioName,
            "network_file": networkFile,
            "is_multi_period": is_mp,
            "periods": periods,
            "period_count": len(periods),
            "snapshot_count": len(network.snapshots),
            "snapshots_per_period": len(network.snapshots) // len(periods) if is_mp else len(network.snapshots)
        }

    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Error listing periods: {error}")
        raise HTTPException(status_code=500, detail=str(error))


# =============================================================================
# PERIOD EXTRACTION
# =============================================================================

@router.post("/pypsa/extract-periods")
async def extract_periods(
    projectPath: str = Body(..., description="Project root path"),
    scenarioName: str = Body(..., description="Scenario folder name"),
    networkFile: str = Body(..., description="Network filename"),
    outputDir: Optional[str] = Body(None, description="Output directory for extracted files")
):
    """
    Extract per-period networks from a multi-period network file.

    Creates separate .nc files for each period in the network.
    Returns paths to extracted period files.
    """
    try:
        network_path = Path(projectPath) / "results" / "pypsa_optimization" / scenarioName / networkFile

        if not network_path.exists():
            raise HTTPException(status_code=404, detail=f"Network file not found: {networkFile}")

        # Set output directory
        if outputDir:
            output_path = Path(outputDir)
        else:
            output_path = network_path.parent / f"{network_path.stem}_periods"

        output_path.mkdir(parents=True, exist_ok=True)

        logger.info(f"Extracting periods from {network_path} to {output_path}")

        # Extract periods
        period_files = extract_period_networks(str(network_path), str(output_path))

        return {
            "success": True,
            "scenario": scenarioName,
            "source_file": networkFile,
            "output_directory": str(output_path),
            "period_files": period_files,
            "period_count": len(period_files),
            "message": f"Extracted {len(period_files)} period networks"
        }

    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Error extracting periods: {error}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(error))


# =============================================================================
# MULTI-FILE ANALYSIS
# =============================================================================

@router.post("/pypsa/analyze-multi-file")
async def analyze_multi_file(
    projectPath: str = Body(..., description="Project root path"),
    scenarioName: str = Body(..., description="Scenario folder name"),
    networkFiles: List[str] = Body(..., description="List of network filenames to analyze")
):
    """
    Analyze multiple network files (year-by-year comparison).

    Processes each file, extracts year from filename, and returns
    year-indexed results for comparison.
    """
    try:
        scenario_path = Path(projectPath) / "results" / "pypsa_optimization" / scenarioName

        if not scenario_path.exists():
            raise HTTPException(status_code=404, detail=f"Scenario folder not found: {scenarioName}")

        # Build full paths
        file_paths = [scenario_path / filename for filename in networkFiles]

        # Verify all files exist
        for file_path in file_paths:
            if not file_path.exists():
                raise HTTPException(status_code=404, detail=f"File not found: {file_path.name}")

        logger.info(f"Processing {len(file_paths)} network files")

        # Process multi-file networks
        networks_by_year = process_multi_file_networks(file_paths)

        # Get basic info for each year
        year_info = {}
        for year, network in networks_by_year.items():
            year_info[year] = {
                "year": year,
                "snapshots": len(network.snapshots),
                "generators": len(network.generators) if hasattr(network, 'generators') else 0,
                "buses": len(network.buses) if hasattr(network, 'buses') else 0,
                "is_solved": hasattr(network, 'generators_t') and hasattr(network.generators_t, 'p') and not network.generators_t.p.empty
            }

        return {
            "success": True,
            "scenario": scenarioName,
            "file_count": len(networkFiles),
            "files_processed": networkFiles,
            "years": sorted(networks_by_year.keys()),
            "year_info": year_info,
            "message": f"Processed {len(networks_by_year)} network years successfully"
        }

    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Error analyzing multi-file networks: {error}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(error))


# =============================================================================
# PERIOD-SPECIFIC ANALYSIS
# =============================================================================

@router.get("/pypsa/period-analysis")
async def period_analysis(
    projectPath: str = Query(..., description="Project root path"),
    scenarioName: str = Query(..., description="Scenario folder name"),
    networkFile: str = Query(..., description="Network filename"),
    period: Optional[int] = Query(None, description="Specific period to analyze (None for all)")
):
    """
    Analyze specific period from a multi-period network.

    If period is specified, analyzes only that period.
    If period is None, returns analysis for all periods.
    """
    try:
        network_path = Path(projectPath) / "results" / "pypsa_optimization" / scenarioName / networkFile

        if not network_path.exists():
            raise HTTPException(status_code=404, detail=f"Network file not found: {networkFile}")

        # Load network
        network = load_network_cached(str(network_path))

        # Check if multi-period
        if not is_multi_period(network):
            return {
                "success": False,
                "message": "Network is not multi-period",
                "is_multi_period": False
            }

        periods = get_periods(network)

        if period is not None:
            if period not in periods:
                raise HTTPException(status_code=400, detail=f"Period {period} not found. Available periods: {periods}")

        # Import the aggregation functions
        from pypsa_multi_period_utils import get_total_generation_by_period, calculate_co2_emissions

        # Get generation by period
        gen_by_period = get_total_generation_by_period(network)

        # Get emissions by period
        emissions_by_period = calculate_co2_emissions(network)

        # Filter to specific period if requested
        if period is not None:
            gen_by_period = gen_by_period[gen_by_period['Period'] == period]
            filtered_emissions = {
                'total_by_period': {period: emissions_by_period['total_by_period'].get(period, 0)},
                'by_carrier_by_period': {period: emissions_by_period['by_carrier_by_period'].get(period, {})},
                'emission_factors': emissions_by_period['emission_factors']
            }
            emissions_by_period = filtered_emissions

        return {
            "success": True,
            "scenario": scenarioName,
            "network_file": networkFile,
            "is_multi_period": True,
            "periods": periods,
            "selected_period": period,
            "generation_by_period": gen_by_period.to_dict('records') if not gen_by_period.empty else [],
            "emissions_by_period": emissions_by_period
        }

    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Error in period analysis: {error}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(error))
