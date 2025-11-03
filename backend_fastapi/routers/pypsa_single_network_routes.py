"""
PyPSA Single Network Visualization Routes
=========================================

API endpoints for detailed analysis of a single PyPSA network.

These endpoints are designed to provide the data required for the detailed
views in the `SingleNetworkView.jsx` component. Each endpoint corresponds
to a specific data category and is optimized for performance.

"""

from fastapi import APIRouter, HTTPException, Query, Response
from pathlib import Path
import logging

# Import utility functions and classes from the comprehensive routes
from .pypsa_comprehensive_routes import (
    validate_project_path,
    validate_filename,
    load_network_cached
)

# Import the new analyzer class
from ..models.pypsa_single_network_analyzer import PyPSASingleNetworkAnalyzer

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/pypsa/overview")
async def get_overview(
    projectPath: str = Query(..., description="Project root path"),
    scenarioName: str = Query(..., description="Scenario name"),
    networkFile: str = Query(..., description="Network file name (.nc)")
):
    """
    Get a high-level overview of the network.
    """
    try:
        # Validate inputs
        validate_project_path(projectPath)
        validate_filename(networkFile, extension=".nc")

        # Construct network path
        network_path = Path(projectPath) / "results" / "pypsa_optimization" / scenarioName / networkFile

        if not network_path.exists():
            raise HTTPException(status_code=404, detail=f"Network file not found: {networkFile}")

        # Load network with caching
        network = load_network_cached(str(network_path))

        # Create analyzer and get overview
        analyzer = PyPSASingleNetworkAnalyzer(network)
        overview = analyzer.get_overview()

        return {
            "success": True,
            **overview
        }

    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Error getting network overview: {error}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get network overview: {str(error)}")

@router.get("/pypsa/buses")
async def get_buses(
    projectPath: str = Query(..., description="Project root path"),
    scenarioName: str = Query(..., description="Scenario name"),
    networkFile: str = Query(..., description="Network file name (.nc)")
):
    """
    Get detailed information about the buses in the network.
    """
    try:
        # Validate inputs
        validate_project_path(projectPath)
        validate_filename(networkFile, extension=".nc")

        # Construct network path
        network_path = Path(projectPath) / "results" / "pypsa_optimization" / scenarioName / networkFile

        if not network_path.exists():
            raise HTTPException(status_code=404, detail=f"Network file not found: {networkFile}")

        # Load network with caching
        network = load_network_cached(str(network_path))

        # Create analyzer and get bus data
        analyzer = PyPSASingleNetworkAnalyzer(network)
        buses_data = analyzer.get_buses()

        return {
            "success": True,
            **buses_data
        }

    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Error getting bus data: {error}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get bus data: {str(error)}")

@router.get("/pypsa/carriers")
async def get_carriers(
    projectPath: str = Query(..., description="Project root path"),
    scenarioName: str = Query(..., description="Scenario name"),
    networkFile: str = Query(..., description="Network file name (.nc)")
):
    """
    Get detailed information about the carriers in the network.
    """
    try:
        # Validate inputs
        validate_project_path(projectPath)
        validate_filename(networkFile, extension=".nc")

        # Construct network path
        network_path = Path(projectPath) / "results" / "pypsa_optimization" / scenarioName / networkFile

        if not network_path.exists():
            raise HTTPException(status_code=404, detail=f"Network file not found: {networkFile}")

        # Load network with caching
        network = load_network_cached(str(network_path))

        # Create analyzer and get carrier data
        analyzer = PyPSASingleNetworkAnalyzer(network)
        carriers_data = analyzer.get_carriers()

        return {
            "success": True,
            **carriers_data
        }

    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Error getting carrier data: {error}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get carrier data:. {str(error)}")

@router.get("/pypsa/generators")
async def get_generators(
    projectPath: str = Query(..., description="Project root path"),
    scenarioName: str = Query(..., description="Scenario name"),
    networkFile: str = Query(..., description="Network file name (.nc)")
):
    """
    Get detailed information about the generators in the network.
    """
    try:
        # Validate inputs
        validate_project_path(projectPath)
        validate_filename(networkFile, extension=".nc")

        # Construct network path
        network_path = Path(projectPath) / "results" / "pypsa_optimization" / scenarioName / networkFile

        if not network_path.exists():
            raise HTTPException(status_code=404, detail=f"Network file not found: {networkFile}")

        # Load network with caching
        network = load_network_cached(str(network_path))

        # Create analyzer and get generator data
        analyzer = PyPSASingleNetworkAnalyzer(network)
        generators_data = analyzer.get_generators()

        return {
            "success": True,
            **generators_data
        }

    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Error getting generator data: {error}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get generator data: {str(error)}")

@router.get("/pypsa/loads")
async def get_loads(
    projectPath: str = Query(..., description="Project root path"),
    scenarioName: str = Query(..., description="Scenario name"),
    networkFile: str = Query(..., description="Network file name (.nc)")
):
    """
    Get detailed information about the loads in the network.
    """
    try:
        # Validate inputs
        validate_project_path(projectPath)
        validate_filename(networkFile, extension=".nc")

        # Construct network path
        network_path = Path(projectPath) / "results" / "pypsa_optimization" / scenarioName / networkFile

        if not network_path.exists():
            raise HTTPException(status_code=404, detail=f"Network file not found: {networkFile}")

        # Load network with caching
        network = load_network_cached(str(network_path))

        # Create analyzer and get load data
        analyzer = PyPSASingleNetworkAnalyzer(network)
        loads_data = analyzer.get_loads()

        return {
            "success": True,
            **loads_data
        }

    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Error getting load data: {error}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get load data: {str(error)}")

@router.get("/pypsa/storage-units")
async def get_storage_units(
    projectPath: str = Query(..., description="Project root path"),
    scenarioName: str = Query(..., description="Scenario name"),
    networkFile: str = Query(..., description="Network file name (.nc)")
):
    """
    Get detailed information about the storage units in the network.
    """
    try:
        # Validate inputs
        validate_project_path(projectPath)
        validate_filename(networkFile, extension=".nc")

        # Construct network path
        network_path = Path(projectPath) / "results" / "pypsa_optimization" / scenarioName / networkFile

        if not network_path.exists():
            raise HTTPException(status_code=404, detail=f"Network file not found: {networkFile}")

        # Load network with caching
        network = load_network_cached(str(network_path))

        # Create analyzer and get storage unit data
        analyzer = PyPSASingleNetworkAnalyzer(network)
        storage_units_data = analyzer.get_storage_units()

        return {
            "success": True,
            **storage_units_data
        }

    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Error getting storage unit data: {error}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get storage unit data: {str(error)}")

@router.get("/pypsa/stores")
async def get_stores(
    projectPath: str = Query(..., description="Project root path"),
    scenarioName: str = Query(..., description="Scenario name"),
    networkFile: str = Query(..., description="Network file name (.nc)")
):
    """
    Get detailed information about the stores (e.g., batteries) in the network.
    """
    try:
        # Validate inputs
        validate_project_path(projectPath)
        validate_filename(networkFile, extension=".nc")

        # Construct network path
        network_path = Path(projectPath) / "results" / "pypsa_optimization" / scenarioName / networkFile

        if not network_path.exists():
            raise HTTPException(status_code=404, detail=f"Network file not found: {networkFile}")

        # Load network with caching
        network = load_network_cached(str(network_path))

        # Create analyzer and get store data
        analyzer = PyPSASingleNetworkAnalyzer(network)
        stores_data = analyzer.get_stores()

        return {
            "success": True,
            **stores_data
        }

    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Error getting store data: {error}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get store data: {str(error)}")

@router.get("/pypsa/links")
async def get_links(
    projectPath: str = Query(..., description="Project root path"),
    scenarioName: str = Query(..., description="Scenario name"),
    networkFile: str = Query(..., description="Network file name (.nc)")
):
    """
    Get detailed information about the links (e.g., DC lines) in the network.
    """
    try:
        # Validate inputs
        validate_project_path(projectPath)
        validate_filename(networkFile, extension=".nc")

        # Construct network path
        network_path = Path(projectPath) / "results" / "pypsa_optimization" / scenarioName / networkFile

        if not network_path.exists():
            raise HTTPException(status_code=404, detail=f"Network file not found: {networkFile}")

        # Load network with caching
        network = load_network_cached(str(network_path))

        # Create analyzer and get link data
        analyzer = PyPSASingleNetworkAnalyzer(network)
        links_data = analyzer.get_links()

        return {
            "success": True,
            **links_data
        }

    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Error getting link data: {error}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get link data: {str(error)}")

@router.get("/pypsa/lines")
async def get_lines(
    projectPath: str = Query(..., description="Project root path"),
    scenarioName: str = Query(..., description="Scenario name"),
    networkFile: str = Query(..., description="Network file name (.nc)")
):
    """
    Get detailed information about the AC transmission lines in the network.
    """
    try:
        # Validate inputs
        validate_project_path(projectPath)
        validate_filename(networkFile, extension=".nc")

        # Construct network path
        network_path = Path(projectPath) / "results" / "pypsa_optimization" / scenarioName / networkFile

        if not network_path.exists():
            raise HTTPException(status_code=404, detail=f"Network file not found: {networkFile}")

        # Load network with caching
        network = load_network_cached(str(network_path))

        # Create analyzer and get line data
        analyzer = PyPSASingleNetworkAnalyzer(network)
        lines_data = analyzer.get_lines()

        return {
            "success": True,
            **lines_data
        }

    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Error getting line data: {error}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get line data: {str(error)}")

@router.get("/pypsa/transformers")
async def get_transformers(
    projectPath: str = Query(..., description="Project root path"),
    scenarioName: str = Query(..., description="Scenario name"),
    networkFile: str = Query(..., description="Network file name (.nc)")
):
    """
    Get detailed information about the transformers in the network.
    """
    try:
        # Validate inputs
        validate_project_path(projectPath)
        validate_filename(networkFile, extension=".nc")

        # Construct network path
        network_path = Path(projectPath) / "results" / "pypsa_optimization" / scenarioName / networkFile

        if not network_path.exists():
            raise HTTPException(status_code=404, detail=f"Network file not found: {networkFile}")

        # Load network with caching
        network = load_network_cached(str(network_path))

        # Create analyzer and get transformer data
        analyzer = PyPSASingleNetworkAnalyzer(network)
        transformers_data = analyzer.get_transformers()

        return {
            "success": True,
            **transformers_data
        }

    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Error getting transformer data: {error}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get transformer data: {str(error)}")

@router.get("/pypsa/global-constraints")
async def get_global_constraints(
    projectPath: str = Query(..., description="Project root path"),
    scenarioName: str = Query(..., description="Scenario name"),
    networkFile: str = Query(..., description="Network file name (.nc)")
):
    """
    Get information about global constraints in the network.
    """
    try:
        # Validate inputs
        validate_project_path(projectPath)
        validate_filename(networkFile, extension=".nc")

        # Construct network path
        network_path = Path(projectPath) / "results" / "pypsa_optimization" / scenarioName / networkFile

        if not network_path.exists():
            raise HTTPException(status_code=404, detail=f"Network file not found: {networkFile}")

        # Load network with caching
        network = load_network_cached(str(network_path))

        # Create analyzer and get global constraint data
        analyzer = PyPSASingleNetworkAnalyzer(network)
        global_constraints_data = analyzer.get_global_constraints()

        return {
            "success": True,
            **global_constraints_data
        }

    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Error getting global constraint data: {error}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get global constraint data: {str(error)}")

@router.get("/pypsa/capacity-factors")
async def get_capacity_factors(
    projectPath: str = Query(..., description="Project root path"),
    scenarioName: str = Query(..., description="Scenario name"),
    networkFile: str = Query(..., description="Network file name (.nc)")
):
    """
    Get capacity factors (utilization) for all generators.
    """
    try:
        # Validate inputs
        validate_project_path(projectPath)
        validate_filename(networkFile, extension=".nc")

        # Construct network path
        network_path = Path(projectPath) / "results" / "pypsa_optimization" / scenarioName / networkFile

        if not network_path.exists():
            raise HTTPException(status_code=404, detail=f"Network file not found: {networkFile}")

        # Load network with caching
        network = load_network_cached(str(network_path))

        # Create analyzer and get capacity factor data
        analyzer = PyPSASingleNetworkAnalyzer(network)
        capacity_factors_data = analyzer.get_capacity_factors()

        return {
            "success": True,
            **capacity_factors_data
        }

    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Error getting capacity factor data: {error}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get capacity factor data: {str(error)}")

@router.get("/pypsa/renewable-share")
async def get_renewable_share(
    projectPath: str = Query(..., description="Project root path"),
    scenarioName: str = Query(..., description="Scenario name"),
    networkFile: str = Query(..., description="Network file name (.nc)")
):
    """
    Calculate the share of renewable energy in the generation mix.
    """
    try:
        # Validate inputs
        validate_project_path(projectPath)
        validate_filename(networkFile, extension=".nc")

        # Construct network path
        network_path = Path(projectPath) / "results" / "pypsa_optimization" / scenarioName / networkFile

        if not network_path.exists():
            raise HTTPException(status_code=404, detail=f"Network file not found: {networkFile}")

        # Load network with caching
        network = load_network_cached(str(network_path))

        # Create analyzer and get renewable share data
        analyzer = PyPSASingleNetworkAnalyzer(network)
        renewable_share_data = analyzer.get_renewable_share()

        return {
            "success": True,
            **renewable_share_data
        }

    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Error getting renewable share data: {error}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get renewable share data: {str(error)}")

@router.get("/pypsa/system-costs")
async def get_system_costs(
    projectPath: str = Query(..., description="Project root path"),
    scenarioName: str = Query(..., description="Scenario name"),
    networkFile: str = Query(..., description="Network file name (.nc)")
):
    """
    Get a detailed breakdown of system costs (CAPEX and OPEX).
    """
    try:
        # Validate inputs
        validate_project_path(projectPath)
        validate_filename(networkFile, extension=".nc")

        # Construct network path
        network_path = Path(projectPath) / "results" / "pypsa_optimization" / scenarioName / networkFile

        if not network_path.exists():
            raise HTTPException(status_code=404, detail=f"Network file not found: {networkFile}")

        # Load network with caching
        network = load_network_cached(str(network_path))

        # Create analyzer and get system costs data
        analyzer = PyPSASingleNetworkAnalyzer(network)
        system_costs_data = analyzer.get_system_costs()

        return {
            "success": True,
            **system_costs_data
        }

    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Error getting system costs data: {error}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get system costs data: {str(error)}")

@router.get("/pypsa/emissions-tracking")
async def get_emissions_tracking(
    projectPath: str = Query(..., description="Project root path"),
    scenarioName: str = Query(..., description="Scenario name"),
    networkFile: str = Query(..., description="Network file name (.nc)")
):
    """
    Get detailed emissions data, including time series.
    """
    try:
        # Validate inputs
        validate_project_path(projectPath)
        validate_filename(networkFile, extension=".nc")

        # Construct network path
        network_path = Path(projectPath) / "results" / "pypsa_optimization" / scenarioName / networkFile

        if not network_path.exists():
            raise HTTPException(status_code=404, detail=f"Network file not found: {networkFile}")

        # Load network with caching
        network = load_network_cached(str(network_path))

        # Create analyzer and get emissions tracking data
        analyzer = PyPSASingleNetworkAnalyzer(network)
        emissions_tracking_data = analyzer.get_emissions_tracking()

        return {
            "success": True,
            **emissions_tracking_data
        }

    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Error getting emissions tracking data: {error}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get emissions tracking data: {str(error)}")

@router.get("/pypsa/reserve-margins")
async def get_reserve_margins(
    projectPath: str = Query(..., description="Project root path"),
    scenarioName: str = Query(..., description="Scenario name"),
    networkFile: str = Query(..., description="Network file name (.nc)")
):
    """
    Calculate system reliability metrics like reserve margin.
    """
    try:
        # Validate inputs
        validate_project_path(projectPath)
        validate_filename(networkFile, extension=".nc")

        # Construct network path
        network_path = Path(projectPath) / "results" / "pypsa_optimization" / scenarioName / networkFile

        if not network_path.exists():
            raise HTTPException(status_code=404, detail=f"Network file not found: {networkFile}")

        # Load network with caching
        network = load_network_cached(str(network_path))

        # Create analyzer and get reserve margin data
        analyzer = PyPSASingleNetworkAnalyzer(network)
        reserve_margins_data = analyzer.get_reserve_margins()

        return {
            "success": True,
            **reserve_margins_data
        }

    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Error getting reserve margin data: {error}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get reserve margin data: {str(error)}")

@router.get("/pypsa/dispatch-analysis")
async def get_dispatch_analysis(
    projectPath: str = Query(..., description="Project root path"),
    scenarioName: str = Query(..., description="Scenario name"),
    networkFile: str = Query(..., description="Network file name (.nc)")
):
    """
    Get time series data for dispatch analysis.
    """
    try:
        # Validate inputs
        validate_project_path(projectPath)
        validate_filename(networkFile, extension=".nc")

        # Construct network path
        network_path = Path(projectPath) / "results" / "pypsa_optimization" / scenarioName / networkFile

        if not network_path.exists():
            raise HTTPException(status_code=404, detail=f"Network file not found: {networkFile}")

        # Load network with caching
        network = load_network_cached(str(network_path))

        # Create analyzer and get dispatch analysis data
        analyzer = PyPSASingleNetworkAnalyzer(network)
        dispatch_analysis_data = analyzer.get_dispatch_analysis()

        return {
            "success": True,
            **dispatch_analysis_data
        }

    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Error getting dispatch analysis data: {error}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get dispatch analysis data: {str(error)}")
