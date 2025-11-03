"""
PyPSA Enhanced Visualization Plot Routes
=========================================

API endpoints for generating interactive PyPSA visualizations with filters.

Features:
- Dynamic plot generation with Plotly
- Support for multiple plot types with customizable filters
- Resolution control (hourly, daily, weekly, monthly)
- Carrier filtering
- Date range filtering
- Multiple plot styles
- HTML/PNG/PDF export

Endpoints:
- POST /project/pypsa/plot/generate - Generate plot with filters
- GET /project/pypsa/plot/availability - Get available plot types for network
"""

from fastapi import APIRouter, HTTPException, Query, Body
from fastapi.responses import HTMLResponse, FileResponse
from pathlib import Path
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
import logging
import json
import tempfile

# Import PyPSA visualization modules
import sys
sys.path.append(str(Path(__file__).parent.parent / "models"))

from complete_pypsa_visualizer import CompletePyPSAVisualizer
from pypsa_comprehensive_analysis import PyPSAComprehensiveAnalyzer
from network_cache import load_network_cached

logger = logging.getLogger(__name__)
router = APIRouter()


# =============================================================================
# REQUEST MODELS
# =============================================================================

class PlotFilters(BaseModel):
    """Filters for plot customization."""
    resolution: Optional[str] = Field("1H", description="Time resolution: 1H, 1D, 1W, 1M")
    start_date: Optional[str] = Field(None, description="Start date for filtering")
    end_date: Optional[str] = Field(None, description="End date for filtering")
    carriers: Optional[List[str]] = Field(None, description="List of carriers to include")
    capacity_type: Optional[str] = Field("optimal", description="Capacity type: optimal, installed, both")
    plot_style: Optional[str] = Field("bar", description="Plot style: bar, pie, treemap")
    flow_type: Optional[str] = Field("heatmap", description="Flow visualization: heatmap, line, sankey")
    price_plot_type: Optional[str] = Field("line", description="Price plot type: line, heatmap, duration_curve")
    buses: Optional[List[str]] = Field(None, description="Specific buses for price plots")
    by_zone: bool = Field(False, description="Group by zone/region")
    stacked: bool = Field(True, description="Stack areas in dispatch plot")


class PlotRequest(BaseModel):
    """Request model for plot generation."""
    network_path: str = Field(..., description="Full path to network file")
    plot_type: str = Field(..., description="Type of plot: dispatch, capacity, storage, transmission, prices, duration_curve, daily_profile, dashboard")
    filters: PlotFilters = Field(default_factory=PlotFilters, description="Plot filters")
    output_format: str = Field("html", description="Output format: html, png, pdf")

    class Config:
        schema_extra = {
            "example": {
                "network_path": "/path/to/network.nc",
                "plot_type": "dispatch",
                "filters": {
                    "resolution": "1D",
                    "carriers": ["solar", "wind", "gas"],
                    "start_date": "2025-01-01",
                    "end_date": "2025-12-31"
                },
                "output_format": "html"
            }
        }


class NetworkPlotRequest(BaseModel):
    """Request using project path and scenario/network names."""
    projectPath: str
    scenarioName: str
    networkFile: str
    plot_type: str
    filters: PlotFilters = Field(default_factory=PlotFilters)
    output_format: str = Field("html")


# =============================================================================
# PLOT GENERATION ENDPOINTS
# =============================================================================

@router.post("/pypsa/plot/generate")
async def generate_plot(request: PlotRequest):
    """
    Generate interactive PyPSA visualization plot.

    Supports multiple plot types with customizable filters:
    - dispatch: Power system dispatch with storage
    - capacity: Installed capacity analysis
    - storage: Storage operation visualization
    - transmission: Transmission flow analysis
    - prices: Nodal price analysis
    - duration_curve: Load/price duration curves
    - daily_profile: Typical daily profiles
    - dashboard: Comprehensive dashboard

    Returns HTML content for embedding or file path for download.
    """
    try:
        # Validate network file
        network_path = Path(request.network_path)
        if not network_path.exists():
            raise HTTPException(status_code=404, detail=f"Network file not found: {request.network_path}")

        if network_path.suffix != '.nc':
            raise HTTPException(status_code=400, detail="Only .nc files are supported")

        # Load network with caching
        logger.info(f"Loading network for plot generation: {network_path}")
        network = load_network_cached(str(network_path))

        # Create visualizer
        visualizer = CompletePyPSAVisualizer(network)

        # Generate plot based on type
        logger.info(f"Generating {request.plot_type} plot")
        fig = _generate_plot_by_type(visualizer, request.plot_type, request.filters)

        if fig is None:
            raise HTTPException(status_code=500, detail="Failed to generate plot")

        # Export based on format
        if request.output_format == "html":
            html_content = fig.to_html(
                include_plotlyjs='cdn',
                config={'responsive': True, 'displayModeBar': True}
            )

            return {
                "success": True,
                "plot_type": request.plot_type,
                "format": "html",
                "content": html_content
            }

        elif request.output_format in ["png", "pdf"]:
            # Save to temporary file
            with tempfile.NamedTemporaryFile(delete=False, suffix=f".{request.output_format}") as tmp:
                fig.write_image(tmp.name)

                return {
                    "success": True,
                    "plot_type": request.plot_type,
                    "format": request.output_format,
                    "file_path": tmp.name
                }

        else:
            raise HTTPException(status_code=400, detail=f"Unsupported output format: {request.output_format}")

    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Error generating plot: {error}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(error))


@router.post("/pypsa/plot/generate-from-project")
async def generate_plot_from_project(request: NetworkPlotRequest):
    """
    Generate plot using project path and scenario/network names.

    Convenience endpoint that constructs the full network path from project components.
    """
    try:
        # Construct network path
        network_path = Path(request.projectPath) / "results" / "pypsa_optimization" / request.scenarioName / request.networkFile

        if not network_path.exists():
            raise HTTPException(status_code=404, detail=f"Network file not found: {network_path}")

        # Create standard plot request
        plot_request = PlotRequest(
            network_path=str(network_path),
            plot_type=request.plot_type,
            filters=request.filters,
            output_format=request.output_format
        )

        # Use the standard plot generation endpoint
        return await generate_plot(plot_request)

    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Error generating plot from project: {error}")
        raise HTTPException(status_code=500, detail=str(error))


@router.get("/pypsa/plot/availability")
async def get_plot_availability(
    projectPath: str = Query(...),
    scenarioName: str = Query(...),
    networkFile: str = Query(...)
):
    """
    Get available plot types for a network file.

    Inspects the network and returns which plot types can be generated
    based on available data.

    Returns:
        dict: Available plot types with metadata
    """
    try:
        # Construct network path
        network_path = Path(projectPath) / "results" / "pypsa_optimization" / scenarioName / networkFile

        if not network_path.exists():
            raise HTTPException(status_code=404, detail=f"Network file not found: {networkFile}")

        # Load network
        network = load_network_cached(str(network_path))

        # Create analyzer to check availability
        analyzer = PyPSAComprehensiveAnalyzer(network)

        # Determine available plots
        availability = {
            "dispatch": {
                "available": _check_dispatch_availability(network),
                "description": "Power system dispatch with generation and storage",
                "filters": ["resolution", "carriers", "start_date", "end_date", "stacked"]
            },
            "capacity": {
                "available": _check_capacity_availability(network),
                "description": "Installed capacity by technology",
                "filters": ["capacity_type", "plot_style", "by_zone"]
            },
            "storage": {
                "available": _check_storage_availability(network),
                "description": "Storage operation and state of charge",
                "filters": ["resolution"]
            },
            "transmission": {
                "available": _check_transmission_availability(network),
                "description": "Transmission line flows and utilization",
                "filters": ["resolution", "flow_type"]
            },
            "prices": {
                "available": _check_prices_availability(network),
                "description": "Nodal electricity prices",
                "filters": ["resolution", "buses", "price_plot_type"]
            },
            "duration_curve": {
                "available": _check_dispatch_availability(network),
                "description": "Load and generation duration curves",
                "filters": []
            },
            "daily_profile": {
                "available": _check_dispatch_availability(network),
                "description": "Typical daily generation and load profiles",
                "filters": ["carriers"]
            },
            "dashboard": {
                "available": _check_capacity_availability(network),
                "description": "Comprehensive system overview dashboard",
                "filters": []
            }
        }

        # Get available carriers for filtering
        carriers = []
        if hasattr(network, 'generators') and 'carrier' in network.generators.columns:
            carriers = sorted(network.generators.carrier.unique().tolist())

        # Get available buses for price filtering
        buses = []
        if hasattr(network, 'buses'):
            buses = network.buses.index.tolist()

        return {
            "success": True,
            "scenario": scenarioName,
            "network_file": networkFile,
            "plots": availability,
            "available_carriers": carriers,
            "available_buses": buses[:20],  # Limit to first 20 buses
            "has_time_series": hasattr(network, 'generators_t') and hasattr(network.generators_t, 'p')
        }

    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Error checking plot availability: {error}")
        raise HTTPException(status_code=500, detail=str(error))


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def _generate_plot_by_type(visualizer: CompletePyPSAVisualizer, plot_type: str, filters: PlotFilters):
    """Generate plot based on type and filters."""

    if plot_type == "dispatch":
        return visualizer.plot_dispatch(
            start_date=filters.start_date,
            end_date=filters.end_date,
            carriers=filters.carriers,
            resolution=filters.resolution,
            stacked=filters.stacked
        )

    elif plot_type == "capacity":
        return visualizer.plot_capacity_analysis(
            plot_type=filters.plot_style,
            capacity_type=filters.capacity_type,
            by_zone=filters.by_zone,
            carriers=filters.carriers
        )

    elif plot_type == "storage":
        return visualizer.plot_storage_operation(
            resolution=filters.resolution,
            carriers=filters.carriers,
            start_date=filters.start_date,
            end_date=filters.end_date
        )

    elif plot_type == "transmission":
        return visualizer.plot_transmission_flows(
            flow_type=filters.flow_type,
            resolution=filters.resolution,
            start_date=filters.start_date,
            end_date=filters.end_date
        )

    elif plot_type == "prices":
        return visualizer.plot_price_analysis(
            plot_type=filters.price_plot_type,
            resolution=filters.resolution,
            buses=filters.buses,
            start_date=filters.start_date,
            end_date=filters.end_date
        )

    else:
        raise ValueError(f"Unsupported plot type: {plot_type}")


def _check_dispatch_availability(network) -> bool:
    """Check if dispatch plot can be generated."""
    return (hasattr(network, 'generators_t') and
            hasattr(network.generators_t, 'p') and
            not network.generators_t.p.empty)


def _check_capacity_availability(network) -> bool:
    """Check if capacity plot can be generated."""
    if hasattr(network, 'generators') and not network.generators.empty:
        has_capacity = 'p_nom' in network.generators.columns or 'p_nom_opt' in network.generators.columns
        return has_capacity
    return False


def _check_storage_availability(network) -> bool:
    """Check if storage plot can be generated."""
    has_storage_units = (hasattr(network, 'storage_units') and
                        not network.storage_units.empty)
    has_stores = (hasattr(network, 'stores') and
                 not network.stores.empty)
    return has_storage_units or has_stores


def _check_transmission_availability(network) -> bool:
    """Check if transmission plot can be generated."""
    has_lines = (hasattr(network, 'lines_t') and
                hasattr(network.lines_t, 'p0') and
                not network.lines_t.p0.empty)
    has_links = (hasattr(network, 'links_t') and
                hasattr(network.links_t, 'p0') and
                not network.links_t.p0.empty)
    return has_lines or has_links


def _check_prices_availability(network) -> bool:
    """Check if price plot can be generated."""
    return (hasattr(network, 'buses_t') and
            hasattr(network.buses_t, 'marginal_price') and
            not network.buses_t.marginal_price.empty)
