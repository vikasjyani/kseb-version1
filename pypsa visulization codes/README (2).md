# PyPSA Network Analysis API

Comprehensive FastAPI-based analysis and visualization suite for PyPSA energy system models.

## 🚀 Features

### Complete Component Analysis
- **Buses**: Voltage levels, zonal grouping, nodal prices
- **Carriers**: CO2 emissions, colors, usage statistics
- **Generators**: Capacity, generation, efficiency, economics
- **Loads**: Demand profiles, peak analysis, load factors
- **Storage Units**: PHS with power-based (MW) analysis
- **Stores**: Batteries with energy-based (MWh) analysis
- **Links**: DC transmission, sector coupling
- **Lines**: AC transmission, utilization
- **Transformers**: Capacity, tap ratios
- **Global Constraints**: CO2 limits, shadow prices

### Advanced Visualizations
- **Dispatch Plots**: Intelligent stacked generation with storage
- **Capacity Analysis**: Bar charts, pie charts, treemaps
- **Storage Operation**: Separate PHS and battery visualization
- **Transmission Flows**: Heatmaps, utilization analysis
- **Price Analysis**: Nodal prices, duration curves
- **Dashboard**: Comprehensive metrics overview

### Performance Metrics
- Capacity factors by technology
- Renewable energy share
- Emissions tracking and intensity
- System costs (CAPEX/OPEX)
- Reserve margins
- Utilization rates

## 📦 Installation

```bash
# Clone the repository
git clone <repository-url>
cd pypsa_analysis

# Install dependencies
pip install -r requirements.txt

# Or using conda
conda env create -f environment.yml
conda activate pypsa-analysis
```

## 🏃 Quick Start

### Starting the API Server

```bash
# Development mode with auto-reload
python -m pypsa_analysis.api

# Or using uvicorn directly
uvicorn pypsa_analysis.api:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at: http://localhost:8000

Interactive documentation: http://localhost:8000/docs

### Basic Usage

```python
import requests

# Upload network file
files = {'file': open('network.nc', 'rb')}
response = requests.post('http://localhost:8000/upload', files=files)
network_path = response.json()['file_path']

# Perform comprehensive analysis
analysis_request = {
    "network_path": network_path,
    "analysis_type": "comprehensive",
    "output_dir": "outputs"
}
response = requests.post('http://localhost:8000/analyze', json=analysis_request)
results = response.json()

# Generate dispatch plot
plot_request = {
    "network_path": network_path,
    "plot_type": "dispatch",
    "resolution": "1H",
    "output_format": "html"
}
response = requests.post('http://localhost:8000/plot', json=plot_request)
plot_info = response.json()
```

## 📚 API Endpoints

### Core Endpoints

#### `POST /analyze`
Perform comprehensive network analysis.

**Request:**
```json
{
  "network_path": "/path/to/network.nc",
  "analysis_type": "comprehensive",
  "output_dir": "outputs"
}
```

**Response:**
```json
{
  "status": "success",
  "network_info": {...},
  "components": [...],
  "metrics": [...],
  "plots_generated": [...],
  "execution_time": 15.3
}
```

#### `POST /plot`
Generate specific visualizations.

**Request:**
```json
{
  "network_path": "/path/to/network.nc",
  "plot_type": "dispatch",
  "resolution": "1H",
  "output_format": "html"
}
```

**Supported plot types:**
- `dispatch`: Power system dispatch
- `capacity`: Installed capacity
- `storage`: Storage operation
- `transmission`: Transmission flows
- `prices`: Nodal prices
- `duration_curve`: Duration curves
- `daily_profile`: Typical daily profile
- `dashboard`: Comprehensive dashboard

#### `POST /components/{component_type}`
Analyze specific component type.

**Component types:**
- `bus`, `carrier`, `generator`, `load`
- `storage_unit`, `store`, `link`, `line`
- `transformer`, `global_constraint`

**Example:**
```bash
curl -X POST "http://localhost:8000/components/generator" \
  -H "Content-Type: application/json" \
  -d '{"network_path": "/path/to/network.nc", "detailed": true}'
```

#### `POST /metrics`
Calculate specific metrics.

**Request:**
```json
{
  "network_path": "/path/to/network.nc",
  "metrics": ["generation", "capacity", "storage", "emissions"]
}
```

#### `POST /upload`
Upload network file for analysis.

**Request:**
```bash
curl -X POST "http://localhost:8000/upload" \
  -F "file=@network.nc"
```

## 🔧 Module Usage

### Component Analyzer

```python
from pypsa_analysis.analyzer import ComponentAnalyzer
import pypsa

# Load network
network = pypsa.Network('network.nc')

# Create analyzer
analyzer = ComponentAnalyzer(network)

# Analyze all components
all_analysis = analyzer.analyze_all_components()

# Analyze specific components
generator_analysis = analyzer.analyze_generators(include_time_series=True)
storage_analysis = analyzer.analyze_storage_units(include_time_series=True)
load_analysis = analyzer.analyze_loads(include_time_series=True)

# Print results
print(f"Total generation: {generator_analysis['time_series']['generation']['total_mwh']} MWh")
print(f"Capacity factors: {generator_analysis['time_series']['generation']['capacity_factors']}")
```

### Enhanced Visualizer

```python
from pypsa_analysis.visualizer import EnhancedVisualizer
import pypsa

# Load network
network = pypsa.Network('network.nc')

# Create visualizer
viz = EnhancedVisualizer(network)

# Generate dispatch plot
fig = viz.plot_dispatch(resolution='1H', stacked=True)
fig.write_html('dispatch.html')

# Generate capacity plot
fig = viz.plot_capacity(capacity_type='optimal', plot_style='bar')
fig.write_html('capacity.html')

# Generate storage operation plot
fig = viz.plot_storage_operation(resolution='1H')
fig.write_html('storage.html')

# Generate transmission flow plot
fig = viz.plot_transmission_flows(resolution='1H', flow_type='heatmap')
fig.write_html('transmission.html')

# Generate price plot
fig = viz.plot_prices(resolution='1H', plot_type='line')
fig.write_html('prices.html')
```

## 📊 Advanced Features

### Multi-Resolution Analysis

```python
# Hourly dispatch
fig = viz.plot_dispatch(resolution='1H')

# Daily aggregation
fig = viz.plot_dispatch(resolution='1D')

# Weekly aggregation
fig = viz.plot_dispatch(resolution='1W')
```

### Carrier Filtering

```python
# Plot only specific carriers
fig = viz.plot_dispatch(carriers=['solar', 'wind', 'gas'])
```

### Date Range Filtering

```python
fig = viz.plot_dispatch(
    resolution='1H',
    start_date='2025-01-01',
    end_date='2025-01-31'
)
```

### Zonal Analysis

```python
# Capacity by zone
fig = viz.plot_capacity(capacity_type='optimal', by_zone=True)
```

## 🎨 Visualization Styles

### Capacity Plots

```python
# Bar chart
fig = viz.plot_capacity(plot_style='bar')

# Pie chart
fig = viz.plot_capacity(plot_style='pie')

# Treemap
fig = viz.plot_capacity(plot_style='treemap')
```

### Transmission Plots

```python
# Heatmap
fig = viz.plot_transmission_flows(flow_type='heatmap')

# Line plot
fig = viz.plot_transmission_flows(flow_type='line')

# Sankey diagram (coming soon)
fig = viz.plot_transmission_flows(flow_type='sankey')
```

### Price Plots

```python
# Time series
fig = viz.plot_prices(plot_type='line')

# Heatmap
fig = viz.plot_prices(plot_type='heatmap')

# Duration curve
fig = viz.plot_prices(plot_type='duration_curve')
```

## 🔍 Component-Specific Analysis

### Generator Analysis

```python
gen_analysis = analyzer.analyze_generators(include_time_series=True)

# Access data
print(f"Total capacity: {gen_analysis['installed_capacity']['total_mw']} MW")
print(f"By carrier: {gen_analysis['installed_capacity']['by_carrier']}")
print(f"Total generation: {gen_analysis['time_series']['generation']['total_mwh']} MWh")
print(f"Capacity factors: {gen_analysis['time_series']['generation']['capacity_factors']}")
```

### Storage Analysis

```python
# Storage Units (e.g., PHS - MW-based)
su_analysis = analyzer.analyze_storage_units(include_time_series=True)
print(f"Type: {su_analysis['type']}")  # power_based_mw
print(f"Power capacity: {su_analysis['power_capacity']['total_mw']} MW")
print(f"Energy capacity: {su_analysis['energy_capacity']['total_mwh']} MWh")
print(f"Round-trip efficiency: {su_analysis['time_series']['operation']['round_trip_efficiency']}")

# Stores (e.g., Batteries - MWh-based)
store_analysis = analyzer.analyze_stores(include_time_series=True)
print(f"Type: {store_analysis['type']}")  # energy_based_mwh
print(f"Energy capacity: {store_analysis['energy_capacity']['total_mwh']} MWh")
print(f"Discharge: {store_analysis['time_series']['operation']['total_discharge_mwh']} MWh")
```

### Load Analysis

```python
load_analysis = analyzer.analyze_loads(include_time_series=True)
print(f"Peak demand: {load_analysis['time_series']['peak_demand_mw']} MW")
print(f"Total demand: {load_analysis['time_series']['total_demand_mwh']} MWh")
print(f"Load factor: {load_analysis['time_series']['load_factor']}")
```

### Transmission Analysis

```python
# Lines (AC)
line_analysis = analyzer.analyze_lines(include_time_series=True)
print(f"Total capacity: {line_analysis['capacity']['total_mva']} MVA")
print(f"Total length: {line_analysis['length']['total_km']} km")

# Links (DC)
link_analysis = analyzer.analyze_links(include_time_series=True)
print(f"Total capacity: {link_analysis['capacity']['total_mw']} MW")
print(f"Average efficiency: {link_analysis['efficiency']['mean']}")
```

## 🛠️ Utility Functions

```python
from pypsa_analysis.utils import (
    load_network_safe,
    resample_timeseries,
    calculate_capacity_factor,
    validate_network,
    export_to_json,
    export_to_excel
)

# Safe network loading
network, error = load_network_safe('network.nc')
if error:
    print(f"Error: {error}")

# Validate network
is_valid, issues = validate_network(network)
if not is_valid:
    print(f"Validation issues: {issues}")

# Calculate capacity factor
cf = calculate_capacity_factor(
    generation=network.generators_t.p['gen1'],
    capacity=network.generators.loc['gen1', 'p_nom'],
    hours=len(network.snapshots)
)

# Export results
export_to_json(analysis_results, 'results.json')
export_to_excel({'generators': gen_df, 'loads': load_df}, 'results.xlsx')
```

## 📈 Performance Considerations

- **Large Networks**: Use `resolution='1D'` or higher for faster processing
- **Memory**: The API can handle networks with millions of snapshots
- **Parallelization**: Set `parallel_processing=True` in AnalysisConfig (future)
- **Caching**: Network files are cached during analysis sessions

## 🧪 Testing

```bash
# Run tests
pytest tests/

# Run with coverage
pytest --cov=pypsa_analysis tests/

# Run specific test
pytest tests/test_analyzer.py::test_generator_analysis
```

## 📝 Examples

See the `examples/` directory for complete examples:

- `basic_analysis.py`: Basic network analysis
- `advanced_visualization.py`: Advanced plotting
- `api_client.py`: API client usage
- `batch_processing.py`: Process multiple networks
- `custom_metrics.py`: Calculate custom metrics

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- PyPSA Team for the excellent energy system modeling framework
- FastAPI for the modern web framework
- Plotly for interactive visualizations

## 📧 Contact

For questions or support, please open an issue on GitHub.

## 🔗 Links

- [PyPSA Documentation](https://pypsa.readthedocs.io/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Plotly Documentation](https://plotly.com/python/)
