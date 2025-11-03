"""
Input Validation Models
=======================

Pydantic models for validating API request parameters.
Ensures data integrity and provides clear error messages.

Features:
- Type validation
- Range constraints
- Path validation
- Custom validators
- Automatic API documentation

Author: KSEB Analytics Team
Date: 2025-10-30
"""

from pydantic import BaseModel, Field, validator
from typing import Optional, List
from pathlib import Path


class PyPSANetworkRequest(BaseModel):
    """Base request model for PyPSA network operations."""

    projectPath: str = Field(..., min_length=1, description="Project root path")
    scenarioName: str = Field(..., min_length=1, description="Scenario name")
    networkFile: str = Field(..., pattern=r'.*\.nc$', description="Network file name (.nc)")

    @validator('projectPath')
    def validate_project_path(cls, v):
        """Validate that project path exists."""
        path = Path(v)
        if not path.exists():
            raise ValueError(f"Project path does not exist: {v}")
        if not path.is_dir():
            raise ValueError(f"Project path is not a directory: {v}")
        return str(path.resolve())

    @validator('scenarioName')
    def validate_scenario_name(cls, v):
        """Validate scenario name format."""
        # Prevent directory traversal
        if '..' in v or '/' in v or '\\' in v:
            raise ValueError("Invalid scenario name: contains invalid characters")
        return v

    @validator('networkFile')
    def validate_network_file(cls, v):
        """Validate network file name."""
        if not v.endswith('.nc'):
            raise ValueError("Network file must have .nc extension")
        # Prevent directory traversal
        if '..' in v or '/' in v or '\\' in v:
            raise ValueError("Invalid network file name: contains invalid characters")
        return v

    def get_network_path(self) -> Path:
        """Get the full path to the network file."""
        return Path(self.projectPath) / "results" / "pypsa_optimization" / self.scenarioName / self.networkFile


class PyPSAAnalysisRequest(PyPSANetworkRequest):
    """Request model for PyPSA analysis operations."""

    include_timeseries: bool = Field(
        default=False,
        description="Include full time series data (may be large)"
    )
    include_summary_only: bool = Field(
        default=True,
        description="Return summary statistics instead of full data"
    )


class PyPSAComparisonRequest(BaseModel):
    """Request model for comparing multiple networks."""

    projectPath: str = Field(..., min_length=1)
    scenarios: List[str] = Field(..., min_items=1, max_items=10)
    networkFiles: Optional[List[str]] = Field(None, description="Specific network files to compare")

    @validator('projectPath')
    def validate_project_path(cls, v):
        path = Path(v)
        if not path.exists():
            raise ValueError(f"Project path does not exist: {v}")
        return str(path.resolve())

    @validator('scenarios')
    def validate_scenarios(cls, v):
        """Validate scenario list."""
        if len(v) > 10:
            raise ValueError("Maximum 10 scenarios can be compared at once")
        for scenario in v:
            if '..' in scenario or '/' in scenario or '\\' in scenario:
                raise ValueError(f"Invalid scenario name: {scenario}")
        return v


class CacheInvalidationRequest(BaseModel):
    """Request model for cache invalidation."""

    filepath: Optional[str] = Field(None, description="Specific file to invalidate (None = clear all)")
    clear_all: bool = Field(default=False, description="Clear entire cache")

    @validator('filepath')
    def validate_filepath(cls, v):
        """Validate filepath if provided."""
        if v is not None:
            # Just basic validation, file doesn't need to exist for invalidation
            if '..' in v:
                raise ValueError("Invalid file path: contains parent directory reference")
        return v
