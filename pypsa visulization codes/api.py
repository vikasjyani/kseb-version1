"""
FastAPI Endpoints for PyPSA Network Analysis
=============================================

RESTful API for comprehensive PyPSA network analysis and visualization.
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks, UploadFile, File
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import pypsa
import logging
from pathlib import Path
from typing import Dict, List, Optional, Any
import json
from datetime import datetime
import tempfile
import os

from .models import (
    AnalysisRequest, PlotRequest, ComponentAnalysisRequest,
    MultiNetworkRequest, MetricsRequest,
    AnalysisResult, PlotResult, ErrorResponse,
    NetworkInfo, ComponentSummary, MetricResult,
    AnalysisConfig, ComponentType, PlotType, Resolution
)
from .analyzer import ComponentAnalyzer
from .visualizer import EnhancedVisualizer

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="PyPSA Network Analysis API",
    description="Comprehensive analysis and visualization API for PyPSA energy system models",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Storage for active analysis tasks
active_tasks: Dict[str, Dict[str, Any]] = {}


# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def load_network(file_path: str) -> pypsa.Network:
    """Load PyPSA network from file."""
    try:
        file_path = Path(file_path)
        
        if not file_path.exists():
            raise FileNotFoundError(f"Network file not found: {file_path}")
        
        logger.info(f"Loading network from {file_path}")
        
        if file_path.suffix == '.nc':
            network = pypsa.Network(str(file_path))
        elif file_path.suffix == '.h5':
            network = pypsa.Network()
            network.import_from_hdf5(str(file_path))
        else:
            raise ValueError(f"Unsupported file format: {file_path.suffix}")
        
        logger.info(f"Network loaded successfully: {len(network.snapshots)} snapshots")
        return network
        
    except Exception as e:
        logger.error(f"Error loading network: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to load network: {str(e)}")


def get_network_info(network: pypsa.Network) -> NetworkInfo:
    """Extract basic network information."""
    info = NetworkInfo(
        name=getattr(network, 'name', 'unnamed'),
        is_solved=hasattr(network, 'generators_t') and hasattr(network.generators_t, 'p') and not network.generators_t.p.empty,
        total_snapshots=len(network.snapshots) if hasattr(network, 'snapshots') else 0,
        is_multi_period=isinstance(network.snapshots, pd.MultiIndex) if hasattr(network, 'snapshots') else False,
        component_counts={}
    )
    
    # Get years
    if hasattr(network, 'snapshots') and len(network.snapshots) > 0:
        try:
            if isinstance(network.snapshots, pd.MultiIndex):
                time_level = network.snapshots.get_level_values(-1)
            else:
                time_level = network.snapshots
            
            if pd.api.types.is_datetime64_any_dtype(time_level):
                info.years = sorted(list(time_level.year.unique()))
        except:
            pass
    
    # Get carriers
    if hasattr(network, 'carriers') and not network.carriers.empty:
        info.carriers = list(network.carriers.index)
    
    # Component counts
    for comp in ['generators', 'loads', 'storage_units', 'stores', 'lines', 'links', 'buses']:
        if hasattr(network, comp):
            df = getattr(network, comp)
            if not df.empty:
                info.component_counts[comp] = len(df)
    
    # Solver status
    if hasattr(network, 'objective'):
        info.objective_value = network.objective
    
    return info


# ============================================================================
# HEALTH CHECK
# ============================================================================

@app.get("/")
async def root():
    """API root endpoint."""
    return {
        "name": "PyPSA Network Analysis API",
        "version": "2.0.0",
        "status": "operational",
        "endpoints": {
            "docs": "/docs",
            "health": "/health",
            "analyze": "/analyze",
            "plot": "/plot",
            "components": "/components/{component_type}",
            "metrics": "/metrics"
        }
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "active_tasks": len(active_tasks)
    }


# ============================================================================
# NETWORK ANALYSIS ENDPOINTS
# ============================================================================

@app.post("/analyze", response_model=AnalysisResult)
async def analyze_network(request: AnalysisRequest, background_tasks: BackgroundTasks):
    """
    Perform comprehensive network analysis.
    
    This endpoint analyzes a PyPSA network file and returns detailed metrics,
    component information, and generates visualizations.
    """
    try:
        start_time = datetime.now()
        logger.info(f"Starting analysis for {request.network_path}")
        
        # Load network
        network = load_network(request.network_path)
        
        # Get basic info
        network_info = get_network_info(network)
        
        # Perform component analysis
        analyzer = ComponentAnalyzer(network)
        component_analysis = analyzer.analyze_all_components(
            include_time_series=(request.analysis_type != AnalysisType.BASIC)
        )
        
        # Build component summaries
        components = []
        for comp_type, comp_data in component_analysis.items():
            if isinstance(comp_data, dict) and comp_data.get('count', 0) > 0:
                summary = ComponentSummary(
                    component_type=comp_type,
                    count=comp_data.get('count', 0),
                    has_time_series=comp_data.get('has_time_series', False),
                    time_series_attributes=comp_data.get('time_series_attributes', []),
                    carriers=comp_data.get('by_carrier', {}).keys() if 'by_carrier' in comp_data else []
                )
                
                # Add capacity info
                if 'installed_capacity' in comp_data:
                    summary.total_capacity_mw = comp_data['installed_capacity'].get('total_mw')
                if 'energy_capacity' in comp_data:
                    summary.total_capacity_mwh = comp_data['energy_capacity'].get('total_mwh')
                
                components.append(summary)
        
        # Calculate key metrics
        metrics = []
        
        # Generation metrics
        if 'generators' in component_analysis:
            gen_data = component_analysis['generators']
            if 'time_series' in gen_data and 'generation' in gen_data['time_series']:
                gen_ts = gen_data['time_series']['generation']
                
                metrics.append(MetricResult(
                    metric_name="total_generation",
                    value=gen_ts.get('total_mwh', 0),
                    unit="MWh",
                    description="Total energy generation"
                ))
                
                metrics.append(MetricResult(
                    metric_name="peak_generation",
                    value=gen_ts.get('peak_mw', 0),
                    unit="MW",
                    description="Peak generation power"
                ))
                
                if 'capacity_factors' in gen_ts:
                    metrics.append(MetricResult(
                        metric_name="capacity_factors",
                        value=gen_ts['capacity_factors'],
                        unit="fraction",
                        description="Capacity factors by carrier"
                    ))
        
        # Load metrics
        if 'loads' in component_analysis:
            load_data = component_analysis['loads']
            if 'time_series' in load_data:
                load_ts = load_data['time_series']
                
                metrics.append(MetricResult(
                    metric_name="total_demand",
                    value=load_ts.get('total_demand_mwh', 0),
                    unit="MWh",
                    description="Total energy demand"
                ))
                
                metrics.append(MetricResult(
                    metric_name="peak_demand",
                    value=load_ts.get('peak_demand_mw', 0),
                    unit="MW",
                    description="Peak demand power"
                ))
                
                metrics.append(MetricResult(
                    metric_name="load_factor",
                    value=load_ts.get('load_factor', 0),
                    unit="fraction",
                    description="System load factor"
                ))
        
        # Storage metrics
        if 'storage_units' in component_analysis:
            su_data = component_analysis['storage_units']
            if 'time_series' in su_data and 'operation' in su_data['time_series']:
                su_ts = su_data['time_series']['operation']
                
                metrics.append(MetricResult(
                    metric_name="storage_units_discharge",
                    value=su_ts.get('total_discharge_mwh', 0),
                    unit="MWh",
                    description="Total storage units discharge"
                ))
                
                metrics.append(MetricResult(
                    metric_name="storage_units_efficiency",
                    value=su_ts.get('round_trip_efficiency', 0),
                    unit="fraction",
                    description="Storage units round-trip efficiency"
                ))
        
        if 'stores' in component_analysis:
            stores_data = component_analysis['stores']
            if 'time_series' in stores_data and 'operation' in stores_data['time_series']:
                stores_ts = stores_data['time_series']['operation']
                
                metrics.append(MetricResult(
                    metric_name="stores_discharge",
                    value=stores_ts.get('total_discharge_mwh', 0),
                    unit="MWh",
                    description="Total stores discharge"
                ))
        
        # Generate plots if requested
        plots_generated = []
        if request.analysis_type in [AnalysisType.COMPREHENSIVE]:
            output_dir = Path(request.output_dir)
            output_dir.mkdir(parents=True, exist_ok=True)
            
            visualizer = EnhancedVisualizer(network)
            
            # Generate key plots
            plot_specs = [
                ('dispatch', visualizer.plot_dispatch),
                ('capacity', lambda: visualizer.plot_capacity()),
                ('storage', visualizer.plot_storage_operation),
            ]
            
            for plot_name, plot_func in plot_specs:
                try:
                    fig = plot_func()
                    plot_path = output_dir / f"{plot_name}.html"
                    fig.write_html(str(plot_path))
                    plots_generated.append(str(plot_path))
                    logger.info(f"Generated plot: {plot_name}")
                except Exception as e:
                    logger.error(f"Error generating {plot_name} plot: {e}")
        
        # Calculate execution time
        execution_time = (datetime.now() - start_time).total_seconds()
        
        result = AnalysisResult(
            status="success",
            network_info=network_info,
            components=components,
            metrics=metrics,
            plots_generated=plots_generated,
            tables_generated=[],
            output_directory=request.output_dir,
            execution_time=execution_time
        )
        
        logger.info(f"Analysis completed in {execution_time:.2f} seconds")
        return result
        
    except Exception as e:
        logger.error(f"Analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


# ============================================================================
# PLOTTING ENDPOINTS
# ============================================================================

@app.post("/plot", response_model=PlotResult)
async def generate_plot(request: PlotRequest):
    """
    Generate specific plot from network.
    
    Supports various plot types including dispatch, capacity, storage,
    transmission, and price visualizations.
    """
    try:
        logger.info(f"Generating {request.plot_type} plot for {request.network_path}")
        
        # Load network
        network = load_network(request.network_path)
        
        # Create visualizer
        visualizer = EnhancedVisualizer(network)
        
        # Generate requested plot
        if request.plot_type == PlotType.DISPATCH:
            fig = visualizer.plot_dispatch(
                resolution=request.resolution.value if request.resolution else '1H',
                carriers=[request.carrier] if request.carrier else None
            )
        
        elif request.plot_type == PlotType.CAPACITY:
            fig = visualizer.plot_capacity(
                capacity_type=request.capacity_type.value if request.capacity_type else 'optimal'
            )
        
        elif request.plot_type == PlotType.STORAGE:
            fig = visualizer.plot_storage_operation(
                resolution=request.resolution.value if request.resolution else '1H'
            )
        
        elif request.plot_type == PlotType.TRANSMISSION:
            fig = visualizer.plot_transmission_flows(
                resolution=request.resolution.value if request.resolution else '1H'
            )
        
        elif request.plot_type == PlotType.PRICES:
            fig = visualizer.plot_prices(
                resolution=request.resolution.value if request.resolution else '1H'
            )
        
        else:
            raise ValueError(f"Unsupported plot type: {request.plot_type}")
        
        # Save plot
        output_dir = Path(tempfile.gettempdir()) / "pypsa_plots"
        output_dir.mkdir(exist_ok=True)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        plot_filename = f"{request.plot_type.value}_{timestamp}.{request.output_format}"
        plot_path = output_dir / plot_filename
        
        if request.output_format == "html":
            fig.write_html(str(plot_path))
        elif request.output_format == "png":
            fig.write_image(str(plot_path))
        elif request.output_format == "pdf":
            fig.write_image(str(plot_path))
        else:
            fig.write_html(str(plot_path))
        
        result = PlotResult(
            status="success",
            plot_type=request.plot_type.value,
            file_path=str(plot_path),
            format=request.output_format,
            metadata={
                "resolution": request.resolution.value if request.resolution else '1H',
                "carrier": request.carrier,
                "capacity_type": request.capacity_type.value if request.capacity_type else None
            }
        )
        
        logger.info(f"Plot generated: {plot_path}")
        return result
        
    except Exception as e:
        logger.error(f"Plot generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Plot generation failed: {str(e)}")


@app.get("/plot/download/{filename}")
async def download_plot(filename: str):
    """Download generated plot file."""
    try:
        plot_path = Path(tempfile.gettempdir()) / "pypsa_plots" / filename
        
        if not plot_path.exists():
            raise HTTPException(status_code=404, detail="Plot file not found")
        
        return FileResponse(
            path=str(plot_path),
            filename=filename,
            media_type="application/octet-stream"
        )
        
    except Exception as e:
        logger.error(f"Download failed: {e}")
        raise HTTPException(status_code=500, detail=f"Download failed: {str(e)}")


# ============================================================================
# COMPONENT ANALYSIS ENDPOINTS
# ============================================================================

@app.post("/components/{component_type}")
async def analyze_component(component_type: ComponentType, 
                           request: ComponentAnalysisRequest):
    """
    Analyze specific network component.
    
    Provides detailed analysis of individual component types like
    generators, storage, loads, transmission lines, etc.
    """
    try:
        logger.info(f"Analyzing {component_type.value} for {request.network_path}")
        
        # Load network
        network = load_network(request.network_path)
        
        # Create analyzer
        analyzer = ComponentAnalyzer(network)
        
        # Analyze requested component
        if component_type == ComponentType.BUS:
            analysis = analyzer.analyze_buses()
        elif component_type == ComponentType.CARRIER:
            analysis = analyzer.analyze_carriers()
        elif component_type == ComponentType.GENERATOR:
            analysis = analyzer.analyze_generators(request.detailed)
        elif component_type == ComponentType.LOAD:
            analysis = analyzer.analyze_loads(request.detailed)
        elif component_type == ComponentType.STORAGE_UNIT:
            analysis = analyzer.analyze_storage_units(request.detailed)
        elif component_type == ComponentType.STORE:
            analysis = analyzer.analyze_stores(request.detailed)
        elif component_type == ComponentType.LINK:
            analysis = analyzer.analyze_links(request.detailed)
        elif component_type == ComponentType.LINE:
            analysis = analyzer.analyze_lines(request.detailed)
        elif component_type == ComponentType.TRANSFORMER:
            analysis = analyzer.analyze_transformers()
        elif component_type == ComponentType.GLOBAL_CONSTRAINT:
            analysis = analyzer.analyze_global_constraints()
        else:
            raise ValueError(f"Unsupported component type: {component_type}")
        
        return JSONResponse(content={
            "component_type": component_type.value,
            "analysis": analysis,
            "timestamp": datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Component analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Component analysis failed: {str(e)}")


# ============================================================================
# METRICS ENDPOINTS
# ============================================================================

@app.post("/metrics")
async def calculate_metrics(request: MetricsRequest):
    """
    Calculate specific metrics from network.
    
    Supports calculation of various performance metrics including
    capacity factors, renewable shares, emissions, costs, etc.
    """
    try:
        logger.info(f"Calculating metrics for {request.network_path}")
        
        # Load network
        network = load_network(request.network_path)
        
        # Create analyzer
        analyzer = ComponentAnalyzer(network)
        
        # Calculate requested metrics
        results = {}
        
        for metric in request.metrics:
            metric_lower = metric.lower()
            
            if 'generation' in metric_lower:
                gen_analysis = analyzer.analyze_generators(include_time_series=True)
                if 'time_series' in gen_analysis:
                    results[metric] = gen_analysis['time_series'].get('generation', {})
            
            elif 'capacity' in metric_lower:
                gen_analysis = analyzer.analyze_generators(include_time_series=False)
                results[metric] = {
                    'installed': gen_analysis.get('installed_capacity', {}),
                    'optimal': gen_analysis.get('optimal_capacity', {})
                }
            
            elif 'storage' in metric_lower:
                su_analysis = analyzer.analyze_storage_units(include_time_series=True)
                stores_analysis = analyzer.analyze_stores(include_time_series=True)
                results[metric] = {
                    'storage_units': su_analysis,
                    'stores': stores_analysis
                }
            
            elif 'load' in metric_lower or 'demand' in metric_lower:
                load_analysis = analyzer.analyze_loads(include_time_series=True)
                results[metric] = load_analysis.get('time_series', {})
            
            elif 'emission' in metric_lower:
                # Calculate emissions
                carriers = analyzer.analyze_carriers()
                gen_analysis = analyzer.analyze_generators(include_time_series=True)
                results[metric] = {
                    'carriers_with_emissions': carriers.get('emissions_stats', {}),
                    'generation_by_carrier': gen_analysis.get('time_series', {}).get('generation', {})
                }
            
            else:
                results[metric] = f"Metric '{metric}' not implemented"
        
        return JSONResponse(content={
            "metrics": results,
            "timestamp": datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Metrics calculation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Metrics calculation failed: {str(e)}")


# ============================================================================
# FILE UPLOAD ENDPOINT
# ============================================================================

@app.post("/upload")
async def upload_network(file: UploadFile = File(...)):
    """
    Upload network file for analysis.
    
    Accepts .nc or .h5 files and stores them temporarily for analysis.
    """
    try:
        logger.info(f"Receiving file upload: {file.filename}")
        
        # Validate file extension
        if not file.filename.endswith(('.nc', '.h5')):
            raise HTTPException(
                status_code=400,
                detail="Invalid file format. Only .nc and .h5 files are supported"
            )
        
        # Create upload directory
        upload_dir = Path(tempfile.gettempdir()) / "pypsa_uploads"
        upload_dir.mkdir(exist_ok=True)
        
        # Save file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        file_path = upload_dir / f"{timestamp}_{file.filename}"
        
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        # Validate network can be loaded
        try:
            network = load_network(str(file_path))
            network_info = get_network_info(network)
        except Exception as e:
            # Clean up invalid file
            file_path.unlink()
            raise HTTPException(
                status_code=400,
                detail=f"Invalid network file: {str(e)}"
            )
        
        return {
            "status": "success",
            "file_path": str(file_path),
            "filename": file.filename,
            "network_info": network_info.dict(),
            "message": "File uploaded successfully"
        }
        
    except Exception as e:
        logger.error(f"File upload failed: {e}")
        raise HTTPException(status_code=500, detail=f"File upload failed: {str(e)}")


# ============================================================================
# ERROR HANDLERS
# ============================================================================

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """Handle HTTP exceptions."""
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(
            error=exc.detail,
            detail=str(exc)
        ).dict()
    )


@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    """Handle general exceptions."""
    logger.error(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content=ErrorResponse(
            error="Internal server error",
            detail=str(exc)
        ).dict()
    )


# ============================================================================
# STARTUP/SHUTDOWN EVENTS
# ============================================================================

@app.on_event("startup")
async def startup_event():
    """Run on application startup."""
    logger.info("PyPSA Analysis API starting up...")
    
    # Create necessary directories
    for dir_name in ["pypsa_plots", "pypsa_uploads"]:
        dir_path = Path(tempfile.gettempdir()) / dir_name
        dir_path.mkdir(exist_ok=True)
    
    logger.info("API ready to accept requests")


@app.on_event("shutdown")
async def shutdown_event():
    """Run on application shutdown."""
    logger.info("PyPSA Analysis API shutting down...")
    
    # Clean up temporary files
    import shutil
    for dir_name in ["pypsa_plots", "pypsa_uploads"]:
        dir_path = Path(tempfile.gettempdir()) / dir_name
        if dir_path.exists():
            try:
                shutil.rmtree(dir_path)
                logger.info(f"Cleaned up {dir_path}")
            except Exception as e:
                logger.error(f"Failed to clean up {dir_path}: {e}")


# ============================================================================
# MAIN
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "api:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
