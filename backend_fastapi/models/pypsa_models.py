"""
Pydantic Models for PyPSA Analysis API
======================================

Data models for API requests and responses.
"""

from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any, Union
from enum import Enum
from datetime import datetime


class AnalysisType(str, Enum):
    """Types of analysis available."""
    BASIC = "basic"
    COMPREHENSIVE = "comprehensive"
    COMPARISON = "comparison"
    TEMPORAL = "temporal"


class PlotType(str, Enum):
    """Types of plots available."""
    DISPATCH = "dispatch"
    CAPACITY = "capacity"
    STORAGE = "storage"
    TRANSMISSION = "transmission"
    PRICES = "prices"
    DURATION_CURVE = "duration_curve"
    DAILY_PROFILE = "daily_profile"
    DASHBOARD = "dashboard"
    ALL = "all"


class Resolution(str, Enum):
    """Time resolution options."""
    HOURLY = "1H"
    DAILY = "1D"
    WEEKLY = "1W"
    MONTHLY = "1M"


class CapacityType(str, Enum):
    """Capacity types to analyze."""
    OPTIMAL = "optimal"
    INSTALLED = "installed"
    BOTH = "both"


class ComponentType(str, Enum):
    """PyPSA component types."""
    BUS = "bus"
    CARRIER = "carrier"
    GENERATOR = "generator"
    LOAD = "load"
    LINK = "link"
    STORE = "store"
    STORAGE_UNIT = "storage_unit"
    LINE = "line"
    LINE_TYPE = "line_type"
    TRANSFORMER = "transformer"
    TRANSFORMER_TYPE = "transformer_type"
    SHUNT_IMPEDANCE = "shunt_impedance"
    GLOBAL_CONSTRAINT = "global_constraint"
    SHAPE = "shape"
    SUB_NETWORK = "sub_network"


# ============================================================================
# Request Models
# ============================================================================

class AnalysisRequest(BaseModel):
    """Request model for network analysis."""
    network_path: str = Field(..., description="Path to PyPSA network file")
    analysis_type: AnalysisType = Field(AnalysisType.COMPREHENSIVE, description="Type of analysis")
    output_dir: Optional[str] = Field("outputs", description="Output directory")
    
    class Config:
        schema_extra = {
            "example": {
                "network_path": "/path/to/network.nc",
                "analysis_type": "comprehensive",
                "output_dir": "analysis_outputs"
            }
        }


class PlotRequest(BaseModel):
    """Request model for generating plots."""
    network_path: str = Field(..., description="Path to PyPSA network file")
    plot_type: PlotType = Field(..., description="Type of plot to generate")
    resolution: Optional[Resolution] = Field(Resolution.HOURLY, description="Time resolution")
    capacity_type: Optional[CapacityType] = Field(CapacityType.OPTIMAL, description="Capacity type")
    carrier: Optional[str] = Field(None, description="Filter by carrier")
    output_format: Optional[str] = Field("html", description="Output format (html/png/pdf)")


class ComponentAnalysisRequest(BaseModel):
    """Request model for component-specific analysis."""
    network_path: str = Field(..., description="Path to PyPSA network file")
    component_type: ComponentType = Field(..., description="Component type to analyze")
    detailed: bool = Field(True, description="Include detailed statistics")


class MultiNetworkRequest(BaseModel):
    """Request model for multi-network comparison."""
    network_paths: List[str] = Field(..., min_items=2, description="List of network file paths")
    output_dir: Optional[str] = Field("comparison_outputs", description="Output directory")


class MetricsRequest(BaseModel):
    """Request model for specific metrics calculation."""
    network_path: str = Field(..., description="Path to PyPSA network file")
    metrics: List[str] = Field(..., description="List of metrics to calculate")


# ============================================================================
# Response Models
# ============================================================================

class NetworkInfo(BaseModel):
    """Basic network information."""
    name: str
    is_solved: bool
    total_snapshots: int
    is_multi_period: bool
    years: List[int] = []
    carriers: List[str] = []
    component_counts: Dict[str, int] = {}
    solver_status: Optional[str] = None
    objective_value: Optional[float] = None


class ComponentSummary(BaseModel):
    """Summary of a network component."""
    component_type: str
    count: int
    has_time_series: bool
    time_series_attributes: List[str] = []
    total_capacity_mw: Optional[float] = None
    total_capacity_mwh: Optional[float] = None
    carriers: List[str] = []


class MetricResult(BaseModel):
    """Single metric result."""
    metric_name: str
    value: Union[float, int, str, Dict, List]
    unit: Optional[str] = None
    description: Optional[str] = None


class AnalysisResult(BaseModel):
    """Complete analysis result."""
    status: str
    network_info: NetworkInfo
    components: List[ComponentSummary]
    metrics: List[MetricResult] = []
    plots_generated: List[str] = []
    tables_generated: List[str] = []
    output_directory: str
    execution_time: float


class PlotResult(BaseModel):
    """Plot generation result."""
    status: str
    plot_type: str
    file_path: str
    format: str
    metadata: Dict[str, Any] = {}


class ErrorResponse(BaseModel):
    """Error response model."""
    error: str
    detail: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.now)


# ============================================================================
# Data Transfer Models
# ============================================================================

class CapacityData(BaseModel):
    """Capacity data model."""
    technology: str
    type: str  # Generator, Storage Unit, Store
    capacity_mw: Optional[float] = None
    capacity_mwh: Optional[float] = None
    max_hours: Optional[float] = None
    carrier: str


class GenerationData(BaseModel):
    """Generation data model."""
    carrier: str
    total_generation_mwh: float
    capacity_factor: Optional[float] = None
    curtailment_mwh: Optional[float] = None
    emissions_tco2: Optional[float] = None


class StorageData(BaseModel):
    """Storage operation data model."""
    storage_type: str  # Storage Unit or Store
    carrier: str
    total_discharge_mwh: float
    total_charge_mwh: float
    cycles: Optional[float] = None
    efficiency: Optional[float] = None


class TransmissionData(BaseModel):
    """Transmission data model."""
    line_id: str
    type: str  # AC or DC
    bus0: str
    bus1: str
    capacity_mw: float
    avg_flow_mw: float
    max_flow_mw: float
    utilization_pct: float


class EmissionsData(BaseModel):
    """Emissions data model."""
    carrier: str
    generation_mwh: float
    emission_rate: float  # tCO2/MWh
    total_emissions_tco2: float


class CostData(BaseModel):
    """Cost data model."""
    component: str
    capex: Optional[float] = None
    opex: Optional[float] = None
    total: Optional[float] = None
    currency: str = "EUR"


# ============================================================================
# Configuration Models
# ============================================================================

class AnalysisConfig(BaseModel):
    """Configuration for analysis."""
    output_dir: str = "pypsa_analysis_outputs"
    figure_format: str = "html"
    table_format: str = "excel"
    time_resolution: str = "1H"
    save_intermediate: bool = True
    parallel_processing: bool = False
    verbose: bool = True
    include_plots: bool = True
    include_tables: bool = True
    
    @validator('figure_format')
    def validate_figure_format(cls, v):
        allowed = ['html', 'png', 'pdf', 'svg']
        if v not in allowed:
            raise ValueError(f"Figure format must be one of {allowed}")
        return v
    
    @validator('table_format')
    def validate_table_format(cls, v):
        allowed = ['excel', 'csv', 'json']
        if v not in allowed:
            raise ValueError(f"Table format must be one of {allowed}")
        return v


# ============================================================================
# Statistical Models
# ============================================================================

class TimeSeriesStats(BaseModel):
    """Statistical summary of time series data."""
    mean: float
    median: float
    std: float
    min: float
    max: float
    q25: float
    q75: float
    count: int


class ComponentStats(BaseModel):
    """Statistics for a component type."""
    component_type: str
    total_count: int
    by_carrier: Dict[str, int] = {}
    by_bus: Dict[str, int] = {}
    time_series: Optional[TimeSeriesStats] = None


class SystemMetrics(BaseModel):
    """System-wide metrics."""
    total_generation_mwh: float
    total_load_mwh: float
    renewable_share_pct: float
    avg_capacity_factor_pct: float
    total_emissions_tco2: float
    emission_intensity: float  # tCO2/MWh
    total_cost_eur: Optional[float] = None
    avg_price_eur_mwh: Optional[float] = None


# ============================================================================
# Comparison Models
# ============================================================================

class NetworkComparison(BaseModel):
    """Comparison between multiple networks."""
    network_names: List[str]
    metrics: Dict[str, List[float]]  # metric_name -> values for each network
    differences: Dict[str, Dict[str, float]] = {}  # relative differences


class TemporalEvolution(BaseModel):
    """Temporal evolution data."""
    parameter: str
    time_points: List[str]  # dates or periods
    values: List[float]
    unit: str
