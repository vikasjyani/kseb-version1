# Quick Start Guide

Get started with PyPSA Analysis Suite in 5 minutes!

## Installation

```bash
# Install dependencies
pip install -r requirements.txt

# Or install directly
pip install pypsa pandas numpy plotly fastapi uvicorn pydantic openpyxl
```

## Quick Examples

### 1. Analyze a Network (Python)

```python
import pypsa
from pypsa_analysis.analyzer import ComponentAnalyzer
from pypsa_analysis.visualizer import EnhancedVisualizer

# Load your network
network = pypsa.Network('path/to/your/network.nc')

# Create analyzer
analyzer = ComponentAnalyzer(network)

# Analyze all components
analysis = analyzer.analyze_all_components()

# Print summary
print(f"Generators: {analysis['generators']['count']}")
print(f"Total capacity: {analysis['generators']['installed_capacity']['total_mw']} MW")
print(f"Total generation: {analysis['generators']['time_series']['generation']['total_mwh']} MWh")

# Create visualizations
viz = EnhancedVisualizer(network)

# Dispatch plot
fig = viz.plot_dispatch()
fig.write_html('dispatch.html')

# Capacity plot
fig = viz.plot_capacity()
fig.write_html('capacity.html')

# Storage plot
fig = viz.plot_storage_operation()
fig.write_html('storage.html')
```

### 2. Start the API Server

```bash
# Start server
python -m pypsa_analysis.api

# Or with uvicorn
uvicorn pypsa_analysis.api:app --reload --port 8000
```

Access the interactive API documentation at: http://localhost:8000/docs

### 3. Use the API (Command Line)

```bash
# Upload network
curl -X POST "http://localhost:8000/upload" \
  -F "file=@network.nc"

# Analyze network
curl -X POST "http://localhost:8000/analyze" \
  -H "Content-Type: application/json" \
  -d '{
    "network_path": "/path/to/network.nc",
    "analysis_type": "comprehensive",
    "output_dir": "outputs"
  }'

# Generate dispatch plot
curl -X POST "http://localhost:8000/plot" \
  -H "Content-Type: application/json" \
  -d '{
    "network_path": "/path/to/network.nc",
    "plot_type": "dispatch",
    "resolution": "1H",
    "output_format": "html"
  }'

# Analyze generators
curl -X POST "http://localhost:8000/components/generator" \
  -H "Content-Type: application/json" \
  -d '{
    "network_path": "/path/to/network.nc",
    "component_type": "generator",
    "detailed": true
  }'
```

### 4. Use the API (Python)

```python
import requests

# Base URL
BASE_URL = "http://localhost:8000"

# Upload network
with open('network.nc', 'rb') as f:
    files = {'file': f}
    response = requests.post(f"{BASE_URL}/upload", files=files)
    network_path = response.json()['file_path']

# Analyze
analysis_request = {
    "network_path": network_path,
    "analysis_type": "comprehensive",
    "output_dir": "outputs"
}
response = requests.post(f"{BASE_URL}/analyze", json=analysis_request)
results = response.json()

print(f"Status: {results['status']}")
print(f"Execution time: {results['execution_time']:.2f}s")
print(f"Components analyzed: {len(results['components'])}")

# Generate plots
for plot_type in ['dispatch', 'capacity', 'storage']:
    plot_request = {
        "network_path": network_path,
        "plot_type": plot_type,
        "resolution": "1H",
        "output_format": "html"
    }
    response = requests.post(f"{BASE_URL}/plot", json=plot_request)
    print(f"{plot_type}: {response.json()['file_path']}")
```

## Key Features

### Component Analysis

Analyze all PyPSA components:

```python
# Generators
gen_analysis = analyzer.analyze_generators(include_time_series=True)

# Storage Units (PHS - MW-based)
su_analysis = analyzer.analyze_storage_units(include_time_series=True)

# Stores (Batteries - MWh-based)
store_analysis = analyzer.analyze_stores(include_time_series=True)

# Loads
load_analysis = analyzer.analyze_loads(include_time_series=True)

# Transmission lines
line_analysis = analyzer.analyze_lines(include_time_series=True)

# DC links
link_analysis = analyzer.analyze_links(include_time_series=True)

# Buses
bus_analysis = analyzer.analyze_buses()

# Carriers
carrier_analysis = analyzer.analyze_carriers()
```

### Visualizations

Create comprehensive visualizations:

```python
viz = EnhancedVisualizer(network)

# Dispatch plot (with multiple resolutions)
viz.plot_dispatch(resolution='1H')   # Hourly
viz.plot_dispatch(resolution='1D')   # Daily
viz.plot_dispatch(resolution='1W')   # Weekly

# Capacity plots (different styles)
viz.plot_capacity(plot_style='bar')
viz.plot_capacity(plot_style='pie')
viz.plot_capacity(plot_style='treemap')

# Storage operation (distinguishes PHS vs Batteries)
viz.plot_storage_operation()

# Transmission flows
viz.plot_transmission_flows(flow_type='heatmap')
viz.plot_transmission_flows(flow_type='line')

# Prices (if network is solved)
viz.plot_prices(plot_type='line')
viz.plot_prices(plot_type='heatmap')
viz.plot_prices(plot_type='duration_curve')
```

### Filtering

Filter analysis by various criteria:

```python
# Filter by carriers
viz.plot_dispatch(carriers=['solar', 'wind', 'hydro'])

# Filter by date range
viz.plot_dispatch(
    start_date='2025-01-01',
    end_date='2025-01-31'
)

# Zonal capacity
viz.plot_capacity(by_zone=True)

# Multi-resolution
for res in ['1H', '6H', '1D', '1W']:
    viz.plot_dispatch(resolution=res)
```

## Common Use Cases

### 1. Quick Network Overview

```python
from pypsa_analysis.utils import get_network_summary, validate_network

network = pypsa.Network('network.nc')

# Get summary
summary = get_network_summary(network)
print(summary)

# Validate
is_valid, issues = validate_network(network)
if not is_valid:
    print("Issues:", issues)
```

### 2. Calculate Specific Metrics

```python
analyzer = ComponentAnalyzer(network)

# Generation metrics
gen = analyzer.analyze_generators(include_time_series=True)
total_gen = gen['time_series']['generation']['total_mwh']
capacity_factors = gen['time_series']['generation']['capacity_factors']

# Load metrics
load = analyzer.analyze_loads(include_time_series=True)
peak_demand = load['time_series']['peak_demand_mw']
load_factor = load['time_series']['load_factor']

# Storage metrics
storage = analyzer.analyze_storage_units(include_time_series=True)
discharge = storage['time_series']['operation']['total_discharge_mwh']
efficiency = storage['time_series']['operation']['round_trip_efficiency']
```

### 3. Export Results

```python
from pypsa_analysis.utils import export_to_json, export_to_excel

# Export to JSON
export_to_json(analysis_results, 'results.json')

# Export to Excel
dataframes = {
    'generators': gen_df,
    'loads': load_df,
    'storage': storage_df
}
export_to_excel(dataframes, 'results.xlsx')
```

### 4. Batch Processing

```python
networks = ['network1.nc', 'network2.nc', 'network3.nc']

results = []
for network_path in networks:
    network = pypsa.Network(network_path)
    analyzer = ComponentAnalyzer(network)
    
    gen = analyzer.analyze_generators(include_time_series=True)
    results.append({
        'network': network_path,
        'total_generation': gen['time_series']['generation']['total_mwh'],
        'installed_capacity': gen['installed_capacity']['total_mw']
    })

import pandas as pd
df = pd.DataFrame(results)
df.to_excel('batch_results.xlsx')
```

## Troubleshooting

### Network Not Solved

If you get "Network not solved" errors:

```python
# Check if network is solved
if hasattr(network, 'generators_t') and hasattr(network.generators_t, 'p'):
    if network.generators_t.p.empty:
        print("Network needs to be solved first")
        network.optimize()
else:
    print("Network needs to be solved first")
    network.optimize()
```

### Missing Dependencies

```bash
# Install missing packages
pip install plotly kaleido openpyxl fastapi uvicorn pydantic
```

### API Not Starting

```bash
# Check if port 8000 is in use
lsof -i :8000

# Use different port
uvicorn pypsa_analysis.api:app --port 8080
```

## Next Steps

1. Read the full documentation in README.md
2. Explore examples in examples.py
3. Check the API documentation at http://localhost:8000/docs
4. Customize visualizations with your own color schemes
5. Extend the analyzer with custom metrics

## Support

- Full documentation: README.md
- Examples: examples.py
- API docs: http://localhost:8000/docs (when running)
- PyPSA docs: https://pypsa.readthedocs.io/

Happy analyzing! 🚀
