"""
PyPSA Network Analysis Suite
=============================

Comprehensive analysis and visualization toolkit for PyPSA energy system models.

This package provides:
- Component-wise analysis for all PyPSA components
- Advanced visualization capabilities
- FastAPI-based REST API
- Comprehensive metrics calculation
- Export capabilities

Main modules:
- analyzer: Comprehensive component analysis
- visualizer: Interactive visualization tools
- api: FastAPI REST API endpoints
- models: Pydantic data models
- utils: Utility functions

Example usage:
-------------
```python
from pypsa_analysis.analyzer import ComponentAnalyzer
from pypsa_analysis.visualizer import EnhancedVisualizer
import pypsa

# Load network
network = pypsa.Network('network.nc')

# Analyze
analyzer = ComponentAnalyzer(network)
analysis = analyzer.analyze_all_components()

# Visualize
viz = EnhancedVisualizer(network)
fig = viz.plot_dispatch()
fig.write_html('dispatch.html')
```

API usage:
---------
```bash
# Start API server
python -m pypsa_analysis.api

# Make requests
curl -X POST "http://localhost:8000/analyze" \\
  -H "Content-Type: application/json" \\
  -d '{"network_path": "network.nc", "analysis_type": "comprehensive"}'
```
"""

__version__ = "2.0.0"
__author__ = "PyPSA Analysis Suite Contributors"
__license__ = "MIT"

from .analyzer import ComponentAnalyzer
from .visualizer import EnhancedVisualizer
from .models import (
    AnalysisRequest,
    PlotRequest,
    ComponentAnalysisRequest,
    AnalysisResult,
    PlotResult,
    AnalysisConfig,
    AnalysisType,
    PlotType,
    ComponentType,
    Resolution
)

__all__ = [
    'ComponentAnalyzer',
    'EnhancedVisualizer',
    'AnalysisRequest',
    'PlotRequest',
    'ComponentAnalysisRequest',
    'AnalysisResult',
    'PlotResult',
    'AnalysisConfig',
    'AnalysisType',
    'PlotType',
    'ComponentType',
    'Resolution',
]
