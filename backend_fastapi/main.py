"""
KSEB Energy Analytics Platform - FastAPI Backend
================================================

This is the main FastAPI application entry point for the KSEB energy demand
forecasting and load profile analysis system.

The backend provides RESTful APIs for:
- Project management (create, load, validate)
- Demand forecasting with ML models
- Load profile generation and analysis
- PyPSA grid optimization
- Real-time progress tracking via Server-Sent Events (SSE)

Original: Node.js/Express backend
Migrated: FastAPI (Python)
Maintained: 100% API compatibility with existing frontend
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

# Import route modules
from routers import (
    project_routes,
    sector_routes,
    parse_excel_routes,
    consolidated_view_routes,
    correlation_routes,
    forecast_routes,
    scenario_routes,
    profile_routes,
    load_profile_routes,
    analysis_routes,
    time_series_routes,
    settings_routes,
    pypsa_routes,
    pypsa_comprehensive_routes,
    pypsa_plot_routes,
    pypsa_multi_period_routes,
    pypsa_model_routes
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.
    Handles startup and shutdown events.
    """
    # Startup
    logger.info("🚀 Starting KSEB FastAPI Backend...")
    logger.info("✅ All route modules loaded successfully")

    yield

    # Shutdown
    logger.info("🛑 Shutting down KSEB FastAPI Backend...")


# Initialize FastAPI application
app = FastAPI(
    title="KSEB Energy Analytics API",
    description="RESTful API for energy demand forecasting, load profile analysis, and grid optimization",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Configure CORS middleware
# Allow all origins to match the Express backend behavior
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all route modules under /project prefix
# This maintains compatibility with the existing frontend
app.include_router(project_routes.router, prefix="/project", tags=["Project Management"])
app.include_router(sector_routes.router, prefix="/project", tags=["Sectors"])
app.include_router(parse_excel_routes.router, prefix="/project", tags=["Excel Parsing"])
app.include_router(consolidated_view_routes.router, prefix="/project", tags=["Consolidated View"])
app.include_router(correlation_routes.router, prefix="/project", tags=["Correlation Analysis"])
app.include_router(forecast_routes.router, prefix="/project", tags=["Demand Forecasting"])
app.include_router(scenario_routes.router, prefix="/project", tags=["Scenarios"])
app.include_router(profile_routes.router, prefix="/project", tags=["Profile Generation"])
app.include_router(load_profile_routes.router, prefix="/project", tags=["Load Profiles"])
app.include_router(analysis_routes.router, prefix="/project", tags=["Analysis"])
app.include_router(time_series_routes.router, prefix="/project", tags=["Time Series"])
app.include_router(settings_routes.router, prefix="/project", tags=["Settings"])
app.include_router(pypsa_routes.router, prefix="/project", tags=["PyPSA Optimization"])
app.include_router(pypsa_comprehensive_routes.router, prefix="/project", tags=["PyPSA Comprehensive Analysis"])
app.include_router(pypsa_plot_routes.router, prefix="/project", tags=["PyPSA Visualizations"])
app.include_router(pypsa_multi_period_routes.router, prefix="/project", tags=["PyPSA Multi-Period"])
app.include_router(pypsa_model_routes.router, prefix="/project", tags=["PyPSA Model"])


@app.get("/", tags=["Root"])
async def root():
    """
    Root endpoint - API health check.

    Returns:
        dict: Server status and version information
    """
    return {
        "message": "KSEB Energy Analytics API",
        "version": "2.0.0",
        "status": "running",
        "framework": "FastAPI",
        "docs": "/docs"
    }


@app.get("/health", tags=["Health"])
async def health_check():
    """
    Health check endpoint for monitoring.

    Returns:
        dict: Health status
    """
    return {"status": "healthy", "service": "kseb-fastapi-backend"}


if __name__ == "__main__":
    import uvicorn

    # Run the application
    # Matches the Express backend port (8000)
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,  # Auto-reload on code changes (development)
        log_level="info"
    )
