"""
Utility Functions for PyPSA Analysis
====================================

Common utility functions used across the analysis suite.
"""

import pandas as pd
import numpy as np
import pypsa
import logging
from typing import Dict, List, Optional, Union, Tuple, Any
from pathlib import Path
from datetime import datetime
import hashlib
import json

logger = logging.getLogger(__name__)


# ============================================================================
# FILE OPERATIONS
# ============================================================================

def ensure_dir(directory: Union[str, Path]) -> Path:
    """
    Ensure directory exists, create if it doesn't.
    
    Parameters
    ----------
    directory : str or Path
        Directory path
        
    Returns
    -------
    Path
        Path object for the directory
    """
    path = Path(directory)
    path.mkdir(parents=True, exist_ok=True)
    return path


def get_file_hash(file_path: Union[str, Path]) -> str:
    """
    Calculate MD5 hash of a file.
    
    Parameters
    ----------
    file_path : str or Path
        Path to file
        
    Returns
    -------
    str
        MD5 hash of file
    """
    hash_md5 = hashlib.md5()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_md5.update(chunk)
    return hash_md5.hexdigest()


def load_network_safe(file_path: Union[str, Path]) -> Tuple[pypsa.Network, Optional[str]]:
    """
    Safely load PyPSA network with error handling.
    
    Parameters
    ----------
    file_path : str or Path
        Path to network file
        
    Returns
    -------
    tuple
        (network, error_message) - network is None if error occurred
    """
    try:
        file_path = Path(file_path)
        
        if not file_path.exists():
            return None, f"File not found: {file_path}"
        
        if file_path.suffix == '.nc':
            network = pypsa.Network(str(file_path))
        elif file_path.suffix == '.h5':
            network = pypsa.Network()
            network.import_from_hdf5(str(file_path))
        else:
            return None, f"Unsupported file format: {file_path.suffix}"
        
        return network, None
        
    except Exception as e:
        return None, f"Error loading network: {str(e)}"


# ============================================================================
# DATA PROCESSING
# ============================================================================

def resample_timeseries(df: pd.DataFrame, resolution: str) -> pd.DataFrame:
    """
    Resample time series data to specified resolution.
    
    Parameters
    ----------
    df : DataFrame
        Time series data with datetime index
    resolution : str
        Target resolution ('1H', '1D', '1W', etc.)
        
    Returns
    -------
    DataFrame
        Resampled data
    """
    if not isinstance(df.index, pd.DatetimeIndex):
        logger.warning("DataFrame does not have datetime index, skipping resampling")
        return df
    
    try:
        return df.resample(resolution).mean()
    except Exception as e:
        logger.error(f"Error resampling data: {e}")
        return df


def aggregate_by_attribute(df: pd.DataFrame, 
                          component_df: pd.DataFrame, 
                          attribute: str = 'carrier') -> pd.DataFrame:
    """
    Aggregate time series data by component attribute.
    
    Parameters
    ----------
    df : DataFrame
        Time series data
    component_df : DataFrame
        Component dataframe with attributes
    attribute : str
        Attribute to aggregate by
        
    Returns
    -------
    DataFrame
        Aggregated data
    """
    if attribute not in component_df.columns:
        logger.warning(f"Attribute '{attribute}' not found in component dataframe")
        return df
    
    result = pd.DataFrame()
    
    for value in component_df[attribute].unique():
        components = component_df[component_df[attribute] == value].index
        cols = df.columns.intersection(components)
        if len(cols) > 0:
            result[value] = df[cols].sum(axis=1)
    
    return result


def filter_date_range(df: pd.DataFrame, 
                     start_date: Optional[str] = None,
                     end_date: Optional[str] = None) -> pd.DataFrame:
    """
    Filter dataframe by date range.
    
    Parameters
    ----------
    df : DataFrame
        Time series data
    start_date : str, optional
        Start date
    end_date : str, optional
        End date
        
    Returns
    -------
    DataFrame
        Filtered data
    """
    if not isinstance(df.index, pd.DatetimeIndex):
        return df
    
    if start_date:
        df = df[df.index >= start_date]
    if end_date:
        df = df[df.index <= end_date]
    
    return df


# ============================================================================
# STATISTICS
# ============================================================================

def calculate_statistics(data: pd.Series) -> Dict[str, float]:
    """
    Calculate comprehensive statistics for a series.
    
    Parameters
    ----------
    data : Series
        Input data
        
    Returns
    -------
    dict
        Statistical measures
    """
    return {
        'mean': float(data.mean()),
        'median': float(data.median()),
        'std': float(data.std()),
        'min': float(data.min()),
        'max': float(data.max()),
        'q25': float(data.quantile(0.25)),
        'q75': float(data.quantile(0.75)),
        'count': int(len(data))
    }


def calculate_capacity_factor(generation: Union[pd.Series, pd.DataFrame],
                             capacity: float,
                             hours: Optional[int] = None) -> float:
    """
    Calculate capacity factor.
    
    Parameters
    ----------
    generation : Series or DataFrame
        Generation time series
    capacity : float
        Installed capacity (MW)
    hours : int, optional
        Number of hours (defaults to length of generation data)
        
    Returns
    -------
    float
        Capacity factor (0-1)
    """
    if capacity <= 0:
        return 0.0
    
    total_generation = generation.sum().sum() if isinstance(generation, pd.DataFrame) else generation.sum()
    hours = hours or len(generation)
    
    return total_generation / (capacity * hours)


def calculate_utilization(flow: pd.Series, 
                         capacity: float) -> Dict[str, float]:
    """
    Calculate utilization statistics.
    
    Parameters
    ----------
    flow : Series
        Power flow time series
    capacity : float
        Line/link capacity
        
    Returns
    -------
    dict
        Utilization metrics
    """
    if capacity <= 0:
        return {'mean': 0, 'max': 0, 'min': 0}
    
    utilization = flow.abs() / capacity * 100
    
    return {
        'mean': float(utilization.mean()),
        'max': float(utilization.max()),
        'min': float(utilization.min()),
        'p95': float(utilization.quantile(0.95))
    }


# ============================================================================
# VALIDATION
# ============================================================================

def validate_network(network: pypsa.Network) -> Tuple[bool, List[str]]:
    """
    Validate network for analysis.
    
    Parameters
    ----------
    network : pypsa.Network
        Network to validate
        
    Returns
    -------
    tuple
        (is_valid, list of issues)
    """
    issues = []
    
    # Check for snapshots
    if not hasattr(network, 'snapshots') or len(network.snapshots) == 0:
        issues.append("Network has no snapshots")
    
    # Check for components
    has_components = False
    for comp in ['generators', 'loads', 'lines', 'links']:
        if hasattr(network, comp) and not getattr(network, comp).empty:
            has_components = True
            break
    
    if not has_components:
        issues.append("Network has no components")
    
    # Check if solved
    if not (hasattr(network, 'generators_t') and 
            hasattr(network.generators_t, 'p') and 
            not network.generators_t.p.empty):
        issues.append("Network has not been solved (no generator dispatch data)")
    
    return len(issues) == 0, issues


def validate_time_series_data(df: pd.DataFrame, 
                              component_name: str) -> Tuple[bool, Optional[str]]:
    """
    Validate time series data.
    
    Parameters
    ----------
    df : DataFrame
        Time series data
    component_name : str
        Name of component for error messages
        
    Returns
    -------
    tuple
        (is_valid, error_message)
    """
    if df.empty:
        return False, f"No data for {component_name}"
    
    if not isinstance(df.index, pd.DatetimeIndex):
        return False, f"{component_name} does not have datetime index"
    
    # Check for missing data
    if df.isnull().any().any():
        pct_missing = (df.isnull().sum().sum() / (len(df) * len(df.columns))) * 100
        if pct_missing > 50:
            return False, f"{component_name} has {pct_missing:.1f}% missing data"
    
    return True, None


# ============================================================================
# FORMATTING
# ============================================================================

def format_number(value: float, 
                 decimals: int = 2, 
                 unit: str = '') -> str:
    """
    Format number for display.
    
    Parameters
    ----------
    value : float
        Number to format
    decimals : int
        Number of decimal places
    unit : str
        Unit to append
        
    Returns
    -------
    str
        Formatted string
    """
    if abs(value) >= 1e9:
        return f"{value/1e9:.{decimals}f}G{unit}"
    elif abs(value) >= 1e6:
        return f"{value/1e6:.{decimals}f}M{unit}"
    elif abs(value) >= 1e3:
        return f"{value/1e3:.{decimals}f}k{unit}"
    else:
        return f"{value:.{decimals}f}{unit}"


def format_duration(seconds: float) -> str:
    """
    Format duration in human-readable format.
    
    Parameters
    ----------
    seconds : float
        Duration in seconds
        
    Returns
    -------
    str
        Formatted duration
    """
    if seconds < 60:
        return f"{seconds:.1f}s"
    elif seconds < 3600:
        return f"{seconds/60:.1f}m"
    else:
        return f"{seconds/3600:.1f}h"


def dict_to_markdown_table(data: Dict[str, Any], 
                           headers: Tuple[str, str] = ('Key', 'Value')) -> str:
    """
    Convert dictionary to markdown table.
    
    Parameters
    ----------
    data : dict
        Dictionary to convert
    headers : tuple
        Column headers
        
    Returns
    -------
    str
        Markdown table
    """
    lines = [
        f"| {headers[0]} | {headers[1]} |",
        "|---|---|"
    ]
    
    for key, value in data.items():
        if isinstance(value, float):
            value = f"{value:.2f}"
        lines.append(f"| {key} | {value} |")
    
    return '\n'.join(lines)


# ============================================================================
# EXPORT
# ============================================================================

def export_to_json(data: Any, 
                  file_path: Union[str, Path],
                  indent: int = 2) -> None:
    """
    Export data to JSON file.
    
    Parameters
    ----------
    data : any
        Data to export
    file_path : str or Path
        Output file path
    indent : int
        JSON indentation
    """
    def json_serializer(obj):
        """Handle non-serializable objects."""
        if isinstance(obj, (pd.Timestamp, datetime)):
            return obj.isoformat()
        elif isinstance(obj, pd.Series):
            return obj.to_dict()
        elif isinstance(obj, pd.DataFrame):
            return obj.to_dict(orient='records')
        elif isinstance(obj, np.integer):
            return int(obj)
        elif isinstance(obj, np.floating):
            return float(obj)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        else:
            return str(obj)
    
    with open(file_path, 'w') as f:
        json.dump(data, f, indent=indent, default=json_serializer)
    
    logger.info(f"Data exported to {file_path}")


def export_to_excel(dataframes: Dict[str, pd.DataFrame], 
                   file_path: Union[str, Path]) -> None:
    """
    Export multiple dataframes to Excel file.
    
    Parameters
    ----------
    dataframes : dict
        Dictionary of {sheet_name: dataframe}
    file_path : str or Path
        Output file path
    """
    with pd.ExcelWriter(file_path, engine='openpyxl') as writer:
        for sheet_name, df in dataframes.items():
            # Truncate sheet name to 31 characters (Excel limit)
            sheet_name = sheet_name[:31]
            df.to_excel(writer, sheet_name=sheet_name)
    
    logger.info(f"Data exported to {file_path}")


# ============================================================================
# NETWORK INSPECTION
# ============================================================================

def get_network_summary(network: pypsa.Network) -> Dict[str, Any]:
    """
    Get comprehensive network summary.
    
    Parameters
    ----------
    network : pypsa.Network
        Network to summarize
        
    Returns
    -------
    dict
        Network summary
    """
    summary = {
        'name': getattr(network, 'name', 'unnamed'),
        'snapshots': len(network.snapshots) if hasattr(network, 'snapshots') else 0,
        'components': {},
        'is_solved': False
    }
    
    # Component counts
    for comp_type in ['buses', 'generators', 'loads', 'storage_units', 
                     'stores', 'lines', 'links', 'transformers']:
        if hasattr(network, comp_type):
            df = getattr(network, comp_type)
            if not df.empty:
                summary['components'][comp_type] = len(df)
    
    # Check if solved
    if (hasattr(network, 'generators_t') and 
        hasattr(network.generators_t, 'p') and 
        not network.generators_t.p.empty):
        summary['is_solved'] = True
    
    # Objective value
    if hasattr(network, 'objective'):
        summary['objective'] = float(network.objective)
    
    return summary


def get_time_info(network: pypsa.Network) -> Dict[str, Any]:
    """
    Extract temporal information from network.
    
    Parameters
    ----------
    network : pypsa.Network
        Network to analyze
        
    Returns
    -------
    dict
        Temporal information
    """
    if not hasattr(network, 'snapshots') or len(network.snapshots) == 0:
        return {'status': 'no_snapshots'}
    
    snapshots = network.snapshots
    info = {
        'total': len(snapshots),
        'is_multi_period': isinstance(snapshots, pd.MultiIndex)
    }
    
    # Get time level
    if isinstance(snapshots, pd.MultiIndex):
        time_level = snapshots.get_level_values(-1)
        info['periods'] = list(snapshots.levels[0].unique())
    else:
        time_level = snapshots
    
    # Extract datetime info
    if pd.api.types.is_datetime64_any_dtype(time_level):
        info['start'] = str(time_level.min())
        info['end'] = str(time_level.max())
        info['years'] = sorted(list(time_level.year.unique()))
        
        # Estimate resolution
        if len(time_level) > 1:
            diffs = pd.Series(time_level).diff().dropna()
            mode_diff = diffs.mode()[0] if not diffs.empty else pd.Timedelta(hours=1)
            info['resolution'] = str(mode_diff)
    
    return info


# ============================================================================
# COLOR UTILITIES
# ============================================================================

def hex_to_rgb(hex_color: str) -> Tuple[int, int, int]:
    """Convert hex color to RGB tuple."""
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))


def rgb_to_hex(rgb: Tuple[int, int, int]) -> str:
    """Convert RGB tuple to hex color."""
    return '#{:02x}{:02x}{:02x}'.format(*rgb)


def generate_color_palette(n_colors: int, base_color: str = '#1f77b4') -> List[str]:
    """
    Generate color palette with n colors.
    
    Parameters
    ----------
    n_colors : int
        Number of colors to generate
    base_color : str
        Base color in hex format
        
    Returns
    -------
    list
        List of hex colors
    """
    import colorsys
    
    base_rgb = hex_to_rgb(base_color)
    base_hsv = colorsys.rgb_to_hsv(*[x/255.0 for x in base_rgb])
    
    colors = []
    for i in range(n_colors):
        hue = (base_hsv[0] + i/n_colors) % 1.0
        rgb = colorsys.hsv_to_rgb(hue, base_hsv[1], base_hsv[2])
        rgb_int = tuple(int(x * 255) for x in rgb)
        colors.append(rgb_to_hex(rgb_int))
    
    return colors
