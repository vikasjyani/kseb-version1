"""
PyPSA Energy System Model - Production Ready Version
Complete energy system optimization with proper logging and progress tracking
Supports both single-year dispatch and multi-year capacity expansion models
"""

import os
import sys
import json
import logging
import datetime
import traceback
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, asdict
from enum import Enum

import pandas as pd
import numpy as np
import pypsa
import numpy_financial as npf
from tqdm import tqdm


# ============================================================================
# CONFIGURATION AND DATA CLASSES
# ============================================================================

class ModelType(Enum):
    """Model execution types"""
    SINGLE_YEAR = "single_year"
    MULTI_YEAR = "multi_year"


class SnapshotCondition(Enum):
    """Snapshot selection methods"""
    ALL_SNAPSHOTS = "All Snapshots"
    CRITICAL_DAYS = "Critical days"
    PEAK_WEEKS = "Peak weeks"


@dataclass
class ModelConfig:
    """Model configuration from JSON"""
    project_folder: str
    scenario_name: str
    input_file_name: str
    base_year: int
    years: List[int]
    model_type: str
    snapshot_condition: str
    weightings: float
    capital_weighting: float
    solver_threads: int = 64
    enable_clustering: bool = False
    enable_monthly_constraints: bool = False
    enable_battery_cycle: bool = False
    enable_committable: bool = False
    ens_limit: float = 0.0005

    @classmethod
    def from_json(cls, json_path: str) -> 'ModelConfig':
        """Load configuration from JSON file"""
        with open(json_path, 'r') as f:
            data = json.load(f)
        return cls(**data)

    def to_dict(self) -> Dict:
        """Convert to dictionary"""
        return asdict(self)


@dataclass
class ModelProgress:
    """Progress tracking for frontend"""
    stage: str
    step: str
    progress: float
    message: str
    timestamp: str
    details: Optional[Dict] = None

    def to_dict(self) -> Dict:
        """Convert to dictionary for JSON serialization"""
        return {
            'stage': self.stage,
            'step': self.step,
            'progress': self.progress,
            'message': self.message,
            'timestamp': self.timestamp,
            'details': self.details or {}
        }


# ============================================================================
# LOGGING SETUP
# ============================================================================

class ProgressLogger:
    """Custom logger with progress tracking for frontend integration"""

    def __init__(self, log_dir: str, scenario_name: str):
        self.log_dir = Path(log_dir)
        self.log_dir.mkdir(parents=True, exist_ok=True)

        self.scenario_name = scenario_name
        self.progress_file = self.log_dir / f"{scenario_name}_progress.json"
        self.log_file = self.log_dir / f"{scenario_name}_model.log"
        self.solver_log_file = self.log_dir / f"{scenario_name}_solver.log"

        # Setup main logger
        self.logger = logging.getLogger(f'PyPSA_{scenario_name}')
        self.logger.setLevel(logging.DEBUG)
        self.logger.handlers.clear()

        # File handler - detailed logging
        fh = logging.FileHandler(self.log_file, mode='w')
        fh.setLevel(logging.DEBUG)
        fh.setFormatter(logging.Formatter(
            '%(asctime)s | %(levelname)-8s | %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        ))
        self.logger.addHandler(fh)

        # Console handler - important messages only
        ch = logging.StreamHandler(sys.stdout)
        ch.setLevel(logging.INFO)
        ch.setFormatter(logging.Formatter(
            '%(asctime)s | %(levelname)-8s | %(message)s',
            datefmt='%H:%M:%S'
        ))
        self.logger.addHandler(ch)

        # Initialize progress tracking
        self.current_stage = ""
        self.current_step = ""
        self.total_steps = 100
        self.completed_steps = 0

    def update_progress(self, stage: str, step: str, progress: float,
                       message: str, details: Optional[Dict] = None):
        """Update progress and log message"""
        timestamp = datetime.datetime.now().isoformat()

        self.current_stage = stage
        self.current_step = step
        self.completed_steps = int(progress)

        # Create progress object
        progress_obj = ModelProgress(
            stage=stage,
            step=step,
            progress=progress,
            message=message,
            timestamp=timestamp,
            details=details
        )

        # Write to progress file for frontend
        with open(self.progress_file, 'w') as f:
            json.dump(progress_obj.to_dict(), f, indent=2)

        # Log the message
        self.logger.info(f"[{stage}] {message} ({progress:.1f}%)")

    def info(self, message: str):
        """Log info message"""
        self.logger.info(message)

    def debug(self, message: str):
        """Log debug message"""
        self.logger.debug(message)

    def warning(self, message: str):
        """Log warning message"""
        self.logger.warning(message)

    def error(self, message: str):
        """Log error message"""
        self.logger.error(message)

    def get_solver_log_path(self) -> str:
        """Get solver log file path"""
        return str(self.solver_log_file)


# ============================================================================
# DATA LOADING AND VALIDATION
# ============================================================================

class DataLoader:
    """Handles loading and validation of input data"""

    def __init__(self, config: ModelConfig, logger: ProgressLogger):
        self.config = config
        self.logger = logger
        self.input_file = config.input_file_name

        # Data containers
        self.generators_base = None
        self.buses = None
        self.links = None
        self.new_generators = None
        self.new_storage = None
        self.demand = None
        self.p_max_pu = None
        self.p_min_pu = None
        self.settings = None

        # Economic parameters
        self.lifetime = None
        self.fom = None
        self.capital_cost = None
        self.wacc = None
        self.fuel_cost = None
        self.startup_cost = None
        self.co2 = None

        # Pipeline data
        self.pipeline_gen_min = None
        self.pipeline_gen_max = None
        self.pipeline_storage = None

    def load_all_data(self) -> bool:
        """Load all required data sheets"""
        try:
            self.logger.update_progress(
                "Data Loading", "Reading Excel file", 5.0,
                "Loading input data from Excel file"
            )

            # Component data
            self.generators_base = self._read_sheet('Generators')
            self.buses = self._read_sheet('Buses')
            self.links = self._read_sheet('Links')
            self.new_generators = self._read_sheet('New_Generators')
            self.new_storage = self._read_sheet('New_Storage')

            self.logger.update_progress(
                "Data Loading", "Component data loaded", 15.0,
                "Loaded component definitions"
            )

            # Time series data
            self.demand = self._read_sheet('Demand')
            self.p_max_pu = self._read_sheet('P_max_pu')
            self.p_min_pu = self._read_sheet('P_min_pu')

            self.logger.update_progress(
                "Data Loading", "Time series loaded", 25.0,
                "Loaded time series data"
            )

            # Economic parameters
            self.lifetime = self._read_sheet('Lifetime')
            self.fom = self._read_sheet('FOM')
            self.capital_cost = self._read_sheet('Capital_cost')
            self.wacc = self._read_sheet('wacc')
            self.fuel_cost = self._read_sheet('Fuel_cost')
            self.startup_cost = self._read_sheet('Startupcost')
            self.co2 = self._read_sheet('CO2')

            self.logger.update_progress(
                "Data Loading", "Economic parameters loaded", 35.0,
                "Loaded economic parameters"
            )

            # Pipeline data
            self.pipeline_gen_max = self._read_sheet('Pipe_Line_Generators_p_max')
            self.pipeline_gen_min = self._read_sheet('Pipe_Line_Generators_p_min')
            self.pipeline_storage = self._read_sheet('Pipe_Line_Storage_p_min')

            # Settings
            self.settings = self._read_sheet('Settings')

            self.logger.update_progress(
                "Data Loading", "All data loaded", 40.0,
                "Successfully loaded all input data",
                details=self._get_data_summary()
            )

            return True

        except Exception as e:
            self.logger.error(f"Failed to load data: {str(e)}")
            self.logger.error(traceback.format_exc())
            return False

    def _read_sheet(self, sheet_name: str) -> pd.DataFrame:
        """Read a sheet with error handling"""
        try:
            df = pd.read_excel(self.input_file, sheet_name=sheet_name)
            self.logger.debug(f"Loaded sheet '{sheet_name}': {len(df)} rows")
            return df
        except Exception as e:
            self.logger.error(f"Failed to read sheet '{sheet_name}': {str(e)}")
            raise

    def _get_data_summary(self) -> Dict:
        """Get summary of loaded data"""
        return {
            'generators': len(self.generators_base),
            'buses': len(self.buses),
            'links': len(self.links),
            'new_generators': len(self.new_generators),
            'new_storage': len(self.new_storage),
            'demand_snapshots': len(self.demand),
            'years_available': [col for col in self.demand.columns if str(col).startswith('20')]
        }


# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def annuity_future_value(rate: float, nper: int, pv: float) -> float:
    """Calculate annuity for capital cost conversion"""
    if nper == 0:
        return 0
    return npf.pmt(rate, nper, pv, fv=0, when='end')


def calculate_annualized_capital_cost(
    capital_cost: float,
    wacc: float,
    lifetime: int,
    fom: float,
    capital_weighting: float = 1
) -> float:
    """Calculate annualized capital cost including FOM"""
    if capital_cost == 0 or lifetime == 0:
        return 0

    annualized = abs(annuity_future_value(wacc, lifetime, capital_cost))
    total_cost = annualized + fom
    return round(total_cost / capital_weighting)


def extract_tables_by_markers(df: pd.DataFrame, marker: str) -> Dict[str, pd.DataFrame]:
    """Extract multiple tables from a sheet based on markers"""
    markers = []
    for i, row in df.iterrows():
        for j, value in enumerate(row):
            if isinstance(value, str) and value.startswith(marker):
                markers.append((i, j, value[len(marker):].strip()))

    tables = {}
    for marker_info in markers:
        start_row, start_col, table_name = marker_info

        # Find table boundaries
        end_row = start_row + 2
        while end_row < len(df) and pd.notnull(df.iloc[end_row, start_col]):
            end_row += 1

        end_col = start_col + 1
        while end_col < len(df.columns) and pd.notnull(df.iloc[start_row + 1, end_col]):
            end_col += 1

        # Extract table
        table = df.iloc[start_row + 1:end_row, start_col:end_col].copy()
        table.columns = table.iloc[0]
        table = table[1:].reset_index(drop=True)
        tables[table_name] = table

    return tables


# ============================================================================
# SNAPSHOT GENERATION
# ============================================================================

class SnapshotGenerator:
    """Generates time snapshots based on user configuration"""

    def __init__(self, config: ModelConfig, data_loader: DataLoader, logger: ProgressLogger):
        self.config = config
        self.data = data_loader
        self.logger = logger

    def generate_single_year_snapshots(self, year: int) -> Tuple[pd.DatetimeIndex, pd.DatetimeIndex]:
        """Generate snapshots for a single year"""
        # Financial year: April to March
        date_range = pd.date_range(
            start=f'{year-1}-04-01',
            end=f'{year}-03-31 23:59:00',
            freq='h',
            inclusive='left'
        )

        condition = self.config.snapshot_condition
        weightings = self.config.weightings

        if condition == "All Snapshots":
            selected_snapshots = self._resample_snapshots(date_range, weightings)
        elif condition == "Critical days":
            selected_snapshots = self._select_critical_days(year, date_range, weightings)
        elif condition == "Peak weeks":
            selected_snapshots = self._select_peak_weeks(year, date_range, weightings)
        else:
            raise ValueError(f"Unknown snapshot condition: {condition}")

        return selected_snapshots, date_range

    def generate_multi_year_snapshots(self, leap_policy: str = "drop_feb29") -> pd.DataFrame:
        """Generate snapshots for multi-year model with leap year handling"""
        year_frames = []

        for fy in self.config.years:
            start_dt = pd.Timestamp(fy-1, 4, 1, 0)
            end_dt = pd.Timestamp(fy, 3, 31, 23)
            period = pd.date_range(start=start_dt, end=end_dt, freq='h')

            # Get demand data
            if fy in self.data.demand.columns:
                series = self.data.demand[fy].iloc[:len(period)].to_numpy()
            else:
                self.logger.warning(f"Year {fy} not found in demand data")
                series = np.zeros(len(period), dtype=float)

            df_year = pd.DataFrame({"demand": series}, index=period)

            # Handle leap years
            if leap_policy == "drop_feb29":
                mask = ~((df_year.index.month == 2) & (df_year.index.day == 29))
                if not mask.all():
                    df_year = df_year.loc[mask]
            elif leap_policy == "trim_end":
                if len(df_year) > 8760:
                    df_year = df_year.iloc[:8760]

            df_year.index.name = "snapshots"
            year_frames.append(df_year)

        df = pd.concat(year_frames).reset_index()

        # Apply snapshot condition
        condition = self.config.snapshot_condition

        if condition == "All Snapshots":
            return df
        elif condition == "Critical days":
            return self._filter_critical_days_multi_year(df)
        elif condition == "Peak weeks":
            return self._filter_peak_weeks_multi_year(df)
        else:
            return df

    def _resample_snapshots(self, date_range: pd.DatetimeIndex, freq_hours: float) -> pd.DatetimeIndex:
        """Resample snapshots to specified frequency"""
        df = date_range.to_frame(name='value', index=False)
        df.columns = ['datetime']
        df = df.set_index('datetime')
        resampled = df.resample(f'{int(freq_hours)}H').mean()
        return resampled.index

    def _select_critical_days(self, year: int, date_range: pd.DatetimeIndex,
                             weightings: float) -> pd.DatetimeIndex:
        """Select critical days based on custom days sheet"""
        custom_days_df = self.data._read_sheet('Custom days')
        custom_days_df['Year'] = custom_days_df['Month'].apply(
            lambda x: year - 1 if x >= 4 else year
        )

        dates = pd.to_datetime({
            'year': custom_days_df['Year'],
            'month': custom_days_df['Month'],
            'day': custom_days_df['Day']
        })

        selected = []
        for date in sorted(dates.unique()):
            hours = pd.date_range(
                start=date,
                end=date + pd.DateOffset(days=1),
                freq='h',
                inclusive='left'
            )
            downsampled = self._resample_snapshots(hours, weightings)
            selected.extend(downsampled)

        return pd.DatetimeIndex(selected)

    def _select_peak_weeks(self, year: int, date_range: pd.DatetimeIndex,
                          weightings: float) -> pd.DatetimeIndex:
        """Select peak week from each month"""
        df = pd.DataFrame()
        df['demand'] = self.data.demand[year][:len(date_range)]
        df['Date_Time'] = date_range
        df['year'] = df['Date_Time'].dt.year
        df['month'] = df['Date_Time'].dt.month
        df['week'] = df['Date_Time'].dt.isocalendar().week
        df.index = df['Date_Time']

        peak_weeks = []
        for (yr, month), group in df.groupby(['year', 'month']):
            weekly_demand = group.groupby('week')['demand'].sum()
            if len(weekly_demand) > 0:
                peak_week = weekly_demand.idxmax()
                peak_week_data = group[group['week'] == peak_week]
                peak_weeks.append(peak_week_data)

        if peak_weeks:
            peak_weeks_df = pd.concat(peak_weeks)
            return self._resample_snapshots(peak_weeks_df.index, weightings)
        else:
            return date_range[:0]

    def _filter_critical_days_multi_year(self, df: pd.DataFrame) -> pd.DataFrame:
        """Filter critical days for multi-year model"""
        custom_days = self.data._read_sheet('Custom days')
        rows = []

        for fy in self.config.years:
            months = custom_days['Month'].to_numpy()
            days = custom_days['Day'].to_numpy()
            years = np.where(months <= 3, fy, fy-1)

            dts = pd.to_datetime(
                {"year": years, "month": months, "day": days},
                errors="coerce"
            )
            dts = pd.Series(dts).dropna().unique()

            for dt in np.sort(dts):
                rng = pd.date_range(
                    start=dt,
                    end=dt + pd.DateOffset(days=1),
                    freq='h',
                    inclusive='left'
                )
                rows.append(rng)

        if rows:
            custom_index = pd.DatetimeIndex(np.concatenate([r.values for r in rows]))
            return df[df['snapshots'].isin(custom_index)].reset_index(drop=True)
        else:
            return df

    def _filter_peak_weeks_multi_year(self, df: pd.DataFrame) -> pd.DataFrame:
        """Filter peak weeks for multi-year model"""
        df2 = df.set_index('snapshots').copy()
        df2['year'] = df2.index.year
        df2['month'] = df2.index.month
        df2['week'] = df2.index.isocalendar().week.astype(int)

        peak_weeks = []
        for (_yr, _mo), grp in df2.groupby(['year', 'month']):
            wk_sums = grp.groupby('week')['demand'].sum()
            if len(wk_sums):
                peak_wk = wk_sums.idxmax()
                peak_weeks.append(grp[grp['week'] == peak_wk])

        if peak_weeks:
            peak_df = pd.concat(peak_weeks).sort_index()
            return peak_df[['demand']].rename_axis('snapshots').reset_index()
        else:
            return df


# ============================================================================
# NETWORK BUILDER
# ============================================================================

class NetworkBuilder:
    """Builds PyPSA network with all components"""

    def __init__(self, config: ModelConfig, data_loader: DataLoader, logger: ProgressLogger):
        self.config = config
        self.data = data_loader
        self.logger = logger
        self.settings_tables = extract_tables_by_markers(data_loader.settings, '~')

    def build_single_year_network(self, year: int, snapshots: pd.DatetimeIndex,
                                   generators_df: pd.DataFrame) -> pypsa.Network:
        """Build network for single year"""
        network = pypsa.Network()
        network.name = f'{self.config.scenario_name}_{year}'
        network.set_snapshots(snapshots)
        network.snapshot_weightings = pd.Series(
            self.config.weightings,
            index=network.snapshots
        )

        self.logger.update_progress(
            "Network Building", f"Year {year} - Adding components", 50.0,
            f"Building network for year {year} with {len(snapshots)} snapshots"
        )

        # Add buses
        self._add_buses(network)

        # Add load
        self._add_load(network, year, snapshots)

        # Add generators
        self._add_existing_generators(network, generators_df, year, snapshots)
        self._add_new_generators(network, year, snapshots)

        # Add storage
        self._add_storage(network, year)

        # Add links
        self._add_links(network)

        # Add carriers
        self._add_carriers(network)

        # Filter by build year
        network.generators = network.generators[network.generators['build_year'] <= year]
        if len(network.stores) > 0:
            network.stores = network.stores[network.stores['build_year'] <= year]

        self.logger.update_progress(
            "Network Building", f"Year {year} - Complete", 55.0,
            f"Network built: {len(network.generators)} generators, "
            f"{len(network.stores)} stores, {len(network.links)} links"
        )

        return network

    def build_multi_year_network(self, snapshots_df: pd.DataFrame) -> pypsa.Network:
        """Build network for multi-year model"""
        network = pypsa.Network()
        network.name = self.config.scenario_name

        snapshots = pd.to_datetime(snapshots_df['snapshots'])

        # Set up multi-period structure
        network.snapshots = pd.MultiIndex.from_arrays([
            snapshots.dt.year.where(snapshots.dt.month < 4, snapshots.dt.year + 1),
            snapshots
        ], names=['period', 'timestep'])

        network.investment_periods = self.config.years
        network.snapshot_weightings = pd.Series(
            self.config.weightings,
            index=network.snapshots
        )

        # Set investment period weightings
        network.investment_period_weightings["years"] = 1

        self.logger.update_progress(
            "Network Building", "Multi-year - Adding components", 50.0,
            f"Building multi-year network for periods {self.config.years}"
        )

        # Add buses
        self._add_buses(network)

        # Add load
        snapshots_df.rename(columns={'demand': 'load'}, inplace=True)
        network.add("Load", "main_load", bus='Main_Bus', p_set=snapshots_df['load'].values)

        # Add base generators
        base_year = min(self.config.years)
        generators = self.data.generators_base.copy()
        if 'p_nom_extendable' not in generators.columns:
            generators['p_nom_extendable'] = False
        generators.loc[generators['carrier'] == 'Market', 'p_nom_extendable'] = True

        # Prepare combined time series
        P_max_pu_combined, P_min_pu_combined = self._prepare_multi_year_timeseries(snapshots_df)

        self._add_existing_generators_multi_year(
            network, generators, base_year, P_max_pu_combined, P_min_pu_combined
        )

        # Add new components for each period
        for year in self.config.years:
            self.logger.debug(f"Adding components for investment period {year}")
            self._add_new_generators_multi_year(
                network, year, P_max_pu_combined, P_min_pu_combined
            )
            self._add_storage(network, year)

        # Add links and carriers
        self._add_links(network)
        self._add_carriers(network)

        # Add backup generator
        network.add("Generator",
            name='Market_backup',
            bus='Main_Bus',
            p_nom=100000,
            p_nom_extendable=True,
            p_min_pu=0,
            p_max_pu=1,
            carrier='Market',
            marginal_cost=100000,
            build_year=min(self.config.years),
            lifetime=1000,
            capital_cost=0,
            committable=False
        )

        self.logger.update_progress(
            "Network Building", "Multi-year - Complete", 55.0,
            f"Network built: {len(network.generators)} generators across {len(self.config.years)} periods"
        )

        return network

    def _add_buses(self, network: pypsa.Network):
        """Add buses to network"""
        for bus_name in self.data.buses['name']:
            network.add("Bus", bus_name)

    def _add_load(self, network: pypsa.Network, year: int, snapshots: pd.DatetimeIndex):
        """Add load to network"""
        demand_load = pd.DataFrame()
        demand_load['snapshot'] = snapshots
        demand_load = demand_load.set_index('snapshot')
        demand_load['load'] = self.data.demand[year][:len(snapshots)].to_list()
        network.add("Load", "main_load", bus='Main_Bus', p_set=demand_load['load'])

    def _get_marginal_cost(self, row: pd.Series, year: int) -> float:
        """Get marginal cost for a generator"""
        if row['carrier'] == 'Market':
            return row['marginal_cost']

        fuel_cost = self.data.fuel_cost.loc[self.data.fuel_cost['TECHNOLOGY'] == row['TECHNOLOGY'], year].iloc[0]
        efficiency = row['efficiency']

        if efficiency > 0:
            return fuel_cost / efficiency
        return 0

    def _get_capital_cost(self, row: pd.Series, year: int) -> float:
        """Get annualized capital cost for a generator"""
        tech = row['TECHNOLOGY']
        wacc = self.data.wacc.loc[self.data.wacc['TECHNOLOGY'] == tech, 'wacc'].iloc[0]
        lifetime = self.data.lifetime.loc[self.data.lifetime['TECHNOLOGY'] == tech, 'years'].iloc[0]
        capital_cost = self.data.capital_cost.loc[self.data.capital_cost['TECHNOLOGY'] == tech, year].iloc[0]
        fom = self.data.fom.loc[self.data.fom['TECHNOLOGY'] == tech, year].iloc[0]

        return calculate_annualized_capital_cost(
            capital_cost, wacc, lifetime, fom, self.config.capital_weighting
        )

    def _add_existing_generators(self, network: pypsa.Network, generators_df: pd.DataFrame,
                                 year: int, snapshots: pd.DatetimeIndex):
        """Add existing generators for single year"""
        p_max_pu = self.data.p_max_pu.set_index('name').T
        p_max_pu.index = pd.to_datetime(p_max_pu.index)
        p_max_pu_reindexed = p_max_pu.reindex(snapshots, method='ffill')

        p_min_pu = self.data.p_min_pu.set_index('name').T
        p_min_pu.index = pd.to_datetime(p_min_pu.index)
        p_min_pu_reindexed = p_min_pu.reindex(snapshots, method='ffill')

        for index, row in generators_df.iterrows():
            if row['TECHNOLOGY'] in p_max_pu_reindexed.columns:
                p_max_pu_series = p_max_pu_reindexed[row['TECHNOLOGY']]
            else:
                p_max_pu_series = 1.0

            if row['TECHNOLOGY'] in p_min_pu_reindexed.columns:
                p_min_pu_series = p_min_pu_reindexed[row['TECHNOLOGY']]
            else:
                p_min_pu_series = 0.0

            network.add(
                "Generator",
                name=row['name'],
                bus=row['bus'],
                p_nom=row['p_nom'],
                p_nom_extendable=row.get('p_nom_extendable', False),
                carrier=row['carrier'],
                marginal_cost=self._get_marginal_cost(row, year),
                capital_cost=self._get_capital_cost(row, year),
                build_year=row['build_year'],
                lifetime=row['lifetime'],
                p_max_pu=p_max_pu_series,
                p_min_pu=p_min_pu_series,
                committable=self.config.enable_committable,
            )

    def _add_new_generators(self, network: pypsa.Network, year: int, snapshots: pd.DatetimeIndex):
        """Add new generators for single year"""
        p_max_pu = self.data.p_max_pu.set_index('name').T
        p_max_pu.index = pd.to_datetime(p_max_pu.index)
        p_max_pu_reindexed = p_max_pu.reindex(snapshots, method='ffill')

        for index, row in self.data.new_generators.iterrows():
            if row['TECHNOLOGY'] in p_max_pu_reindexed.columns:
                p_max_pu_series = p_max_pu_reindexed[row['TECHNOLOGY']]
            else:
                p_max_pu_series = 1.0

            network.add(
                "Generator",
                name=row['name'],
                bus=row['bus'],
                p_nom_extendable=True,
                carrier=row['carrier'],
                marginal_cost=self._get_marginal_cost(row, year),
                capital_cost=self._get_capital_cost(row, year),
                build_year=row['build_year'],
                lifetime=row['lifetime'],
                p_max_pu=p_max_pu_series,
            )

    def _add_existing_generators_multi_year(self, network: pypsa.Network,
                                           generators_df: pd.DataFrame,
                                           base_year: int,
                                           P_max_pu: pd.DataFrame,
                                           P_min_pu: pd.DataFrame):
        """Add existing generators for multi-year model"""
        for index, row in generators_df.iterrows():
            network.add(
                "Generator",
                name=row['name'],
                bus=row['bus'],
                p_nom=row['p_nom'],
                p_nom_extendable=row.get('p_nom_extendable', False),
                carrier=row['carrier'],
                marginal_cost=self._get_marginal_cost(row, base_year),
                capital_cost=0, # No capital cost for existing generators
                build_year=base_year,
                lifetime=row['lifetime'],
                p_max_pu=P_max_pu[row['TECHNOLOGY']] if row['TECHNOLOGY'] in P_max_pu else 1.0,
                p_min_pu=P_min_pu[row['TECHNOLOGY']] if row['TECHNOLOGY'] in P_min_pu else 0.0,
            )

    def _add_new_generators_multi_year(self, network: pypsa.Network, year: int,
                                       P_max_pu: pd.DataFrame, P_min_pu: pd.DataFrame):
        """Add new generators for specific investment period"""
        for index, row in self.data.new_generators.iterrows():
            if row['build_year'] == year:
                network.add(
                    "Generator",
                    name=f"{row['name']}_{year}",
                    bus=row['bus'],
                    p_nom_extendable=True,
                    carrier=row['carrier'],
                    marginal_cost=self._get_marginal_cost(row, year),
                    capital_cost=self._get_capital_cost(row, year),
                    build_year=year,
                    lifetime=row['lifetime'],
                    p_max_pu=P_max_pu[row['TECHNOLOGY']] if row['TECHNOLOGY'] in P_max_pu else 1.0,
                    p_min_pu=P_min_pu[row['TECHNOLOGY']] if row['TECHNOLOGY'] in P_min_pu else 0.0,
                )

    def _add_storage(self, network: pypsa.Network, year: int):
        """Add storage components"""
        for index, row in self.data.new_storage.iterrows():
            network.add(
                "Store",
                name=row['name'],
                bus=row['bus'],
                e_nom_extendable=True,
                carrier=row['carrier'],
                capital_cost=self._get_capital_cost(row, year),
                build_year=row['build_year'],
                lifetime=row['lifetime'],
                e_cyclic=self.config.enable_battery_cycle,
            )

    def _add_links(self, network: pypsa.Network):
        """Add links between buses"""
        for index, row in self.data.links.iterrows():
            network.add(
                "Link",
                name=row['name'],
                bus0=row['bus0'],
                bus1=row['bus1'],
                p_nom=row['p_nom'],
                p_nom_extendable=row.get('p_nom_extendable', False),
                carrier=row['carrier'],
                marginal_cost=row['marginal_cost'],
                capital_cost=row['capital_cost'],
                build_year=row['build_year'],
                lifetime=row['lifetime'],
            )

    def _add_carriers(self, network: pypsa.Network):
        """Add carriers with CO2 emissions"""
        for idx, carrier in self.data.co2.iterrows():
            network.add('Carrier',
                name=carrier['TECHNOLOGY'],
                co2_emissions=carrier.get('tonnes/MWh', 0),
                color=carrier.get('color', 'gray')
            )

    def _prepare_multi_year_timeseries(self, snapshots_df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.DataFrame]:
        """Prepare combined time series for multi-year model"""
        p_max_pu = self.data.p_max_pu.set_index('name').T
        p_max_pu.index = pd.to_datetime(p_max_pu.index)

        p_min_pu = self.data.p_min_pu.set_index('name').T
        p_min_pu.index = pd.to_datetime(p_min_pu.index)

        p_max_pu_combined = pd.DataFrame(index=snapshots_df['snapshots'], columns=p_max_pu.columns)
        p_min_pu_combined = pd.DataFrame(index=snapshots_df['snapshots'], columns=p_min_pu.columns)

        for year in self.config.years:
            year_snapshots = snapshots_df[snapshots_df['snapshots'].dt.year == year]['snapshots']
            p_max_pu_reindexed = p_max_pu.reindex(year_snapshots, method='ffill')
            p_min_pu_reindexed = p_min_pu.reindex(year_snapshots, method='ffill')
            p_max_pu_combined.update(p_max_pu_reindexed)
            p_min_pu_combined.update(p_min_pu_reindexed)

        return p_max_pu_combined.fillna(1.0), p_min_pu_combined.fillna(0.0)


# ============================================================================
# OPTIMIZATION ENGINE
# ============================================================================

class OptimizationEngine:
    """Handles model optimization with proper solver configuration"""

    def __init__(self, config: ModelConfig, logger: ProgressLogger):
        self.config = config
        self.logger = logger

        self.solver_options = {
            'log_file': logger.get_solver_log_path(),
            'threads': config.solver_threads,
            'solver': 'simplex',
            'parallel': 'on',
            'presolve': 'on',
            'log_to_console': True
        }

    def optimize_single_year(self, network: pypsa.Network, year: int) -> bool:
        """Optimize single year model"""
        try:
            self.logger.update_progress(
                "Optimization", f"Year {year} - Investment", 60.0,
                f"Running investment optimization for year {year}"
            )

            # First optimization - investment
            network.optimize(
                solver_name='highs',
                solver_options=self.solver_options
            )

            # Update capacities
            network.generators.loc[
                network.generators['p_nom'] < network.generators['p_nom_opt'],
                'p_nom'
            ] = network.generators['p_nom_opt']

            network.generators.loc[
                network.generators['committable'] == True,
                ['p_min_pu', 'p_max_pu']
            ] = [0.95, 1.0]

            self.logger.update_progress(
                "Optimization", f"Year {year} - Dispatch", 75.0,
                f"Running dispatch optimization for year {year}"
            )

            # Second optimization - dispatch
            network.optimize(
                solver_name='highs',
                solver_options=self.solver_options
            )

            self.logger.update_progress(
                "Optimization", f"Year {year} - Complete", 85.0,
                f"Optimization for year {year} completed successfully"
            )

            return True

        except Exception as e:
            self.logger.error(f"Optimization failed for year {year}: {str(e)}")
            self.logger.error(traceback.format_exc())
            return False

    def optimize_multi_year(self, network: pypsa.Network) -> bool:
        """Optimize multi-year model"""
        try:
            self.logger.update_progress(
                "Optimization", "Multi-year - Investment", 60.0,
                "Running multi-year investment optimization"
            )

            network.optimize(
                solver_name='highs',
                solver_options=self.solver_options
            )

            self.logger.update_progress(
                "Optimization", "Multi-year - Complete", 85.0,
                "Multi-year optimization completed successfully"
            )

            return True

        except Exception as e:
            self.logger.error(f"Multi-year optimization failed: {str(e)}")
            self.logger.error(traceback.format_exc())
            return False

# ============================================================================
# RESULTS EXPORTER
# ============================================================================

class ResultsExporter:
    """Exports optimization results to Excel"""

    def __init__(self, config: ModelConfig, logger: ProgressLogger):
        self.config = config
        self.logger = logger
        self.output_dir = Path(config.project_folder) / "results" / "pypsa_optimization" / config.scenario_name
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def export_results(self, network: pypsa.Network, year: Optional[int] = None):
        """Export results to Excel and CSV"""
        try:
            self.logger.update_progress(
                "Exporting Results", "Preparing data", 90.0,
                "Preparing results for export"
            )

            file_suffix = f"_{year}" if year else ""
            excel_path = self.output_dir / f"Pypsa_results{file_suffix}.xlsx"

            with pd.ExcelWriter(excel_path) as writer:
                # Export various components
                for comp in ['generators', 'stores', 'storage_units', 'lines', 'links', 'buses']:
                    df = getattr(network, comp, pd.DataFrame())
                    if not df.empty:
                        df.to_excel(writer, sheet_name=comp, index=True)

                # Export time series data
                for comp in ['generators_t', 'stores_t', 'storage_units_t', 'lines_t', 'links_t', 'buses_t']:
                    ts_data = getattr(network, comp, {})
                    for key, df in ts_data.items():
                        if not df.empty:
                            sheet_name = f"{comp}_{key}"
                            df.to_excel(writer, sheet_name=sheet_name[:31], index=True)

            # Export network to NetCDF
            netcdf_path = self.output_dir / f"{network.name}.nc"
            network.export_to_netcdf(netcdf_path)

            self.logger.update_progress(
                "Exporting Results", "Complete", 98.0,
                f"Results exported to {excel_path} and {netcdf_path}"
            )

        except Exception as e:
            self.logger.error(f"Failed to export results: {str(e)}")
            self.logger.error(traceback.format_exc())

# ============================================================================
# MAIN MODEL ORCHESTRATOR
# ============================================================================

class PyPSAModel:
    """Orchestrates the entire PyPSA modeling process"""

    def __init__(self, config: ModelConfig):
        self.config = config
        log_dir = Path(config.project_folder) / "Logs"
        self.logger = ProgressLogger(str(log_dir), config.scenario_name)
        self.data_loader = DataLoader(config, self.logger)
        self.snapshot_generator = SnapshotGenerator(config, self.data_loader, self.logger)
        self.network_builder = NetworkBuilder(config, self.data_loader, self.logger)
        self.optimizer = OptimizationEngine(config, self.logger)
        self.exporter = ResultsExporter(config, self.logger)

    def run(self):
        """Run the full modeling process"""
        try:
            self.logger.update_progress("Initialization", "Starting", 0.0, "Starting PyPSA model run")

            if not self.data_loader.load_all_data():
                raise RuntimeError("Data loading failed")

            if self.config.model_type == ModelType.SINGLE_YEAR.value:
                self._run_single_year()
            elif self.config.model_type == ModelType.MULTI_YEAR.value:
                self._run_multi_year()
            else:
                raise ValueError(f"Unknown model type: {self.config.model_type}")

            self.logger.update_progress("Completion", "Finished", 100.0, "Model run completed successfully!")

        except Exception as e:
            self.logger.error(f"Model run failed: {str(e)}")
            self.logger.error(traceback.format_exc())
            self.logger.update_progress("Error", "Failed", 99.0, f"Error: {str(e)}")

    def _run_single_year(self):
        """Run single-year optimization"""
        year = self.config.base_year
        self.logger.info(f"Starting single-year model for {year}")

        snapshots, date_range = self.snapshot_generator.generate_single_year_snapshots(year)

        network = self.network_builder.build_single_year_network(
            year, snapshots, self.data.generators_base
        )

        if self.optimizer.optimize_single_year(network, year):
            self.exporter.export_results(network, year)

    def _run_multi_year(self):
        """Run multi-year optimization"""
        self.logger.info(f"Starting multi-year model for periods {self.config.years}")

        snapshots_df = self.snapshot_generator.generate_multi_year_snapshots()

        network = self.network_builder.build_multi_year_network(snapshots_df)

        if self.optimizer.optimize_multi_year(network):
            self.exporter.export_results(network)

# ============================================================================
# COMMAND-LINE INTERFACE
# ============================================================================

if __name__ == '__main__':
    if len(sys.argv) != 2:
        print("Usage: python pypsa_model_main.py <path_to_config.json>")
        sys.exit(1)

    config_path = sys.argv[1]
    if not os.path.exists(config_path):
        print(f"Error: Config file not found at {config_path}")
        sys.exit(1)

    try:
        config = ModelConfig.from_json(config_path)
        model = PyPSAModel(config)
        model.run()
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        traceback.print_exc()
        sys.exit(1)

from fastapi import APIRouter, HTTPException, Query, Body
from fastapi.responses import StreamingResponse
import asyncio
import json

router = APIRouter()

# Global queue for SSE events
model_event_queue: asyncio.Queue = None

@router.get("/project/pypsa-model-progress")
async def pypsa_model_progress():
    """
    Server-Sent Events endpoint for real-time model progress.
    """
    global model_event_queue

    async def event_generator():
        """Generate SSE events from the queue"""
        try:
            if model_event_queue is None:
                raise HTTPException(status_code=500, detail="Event queue not initialized")

            while True:
                try:
                    event = await asyncio.wait_for(
                        model_event_queue.get(),
                        timeout=15.0
                    )
                    event_type = event.get('type', 'progress')
                    yield f"event: {event_type}\n"
                    yield f"data: {json.dumps(event)}\n\n"
                    if event_type == 'end':
                        break
                except asyncio.TimeoutError:
                    yield ": keep-alive\n\n"
        except Exception as e:
            yield f"event: error\n"
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

@router.post("/project/run-pypsa-model")
async def run_pypsa_model(
    projectPath: str = Body(..., description="Project root path"),
    scenarioName: str = Body(..., description="Scenario name")
):
    """
    Run the PyPSA model asynchronously.
    """
    global model_event_queue
    model_event_queue = asyncio.Queue()

    try:
        # This is a placeholder for where the config would be loaded from
        # For now, we'll create a dummy config
        config = ModelConfig(
            project_folder=projectPath,
            scenario_name=scenarioName,
            input_file_name=str(Path(projectPath) / "input" / "PyPSA_Input_Data.xlsx"),
            base_year=2026,
            years=[2026],
            model_type='single_year',
            snapshot_condition='All Snapshots',
            weightings=1.0,
            capital_weighting=1.0
        )

        # Start Python process in background
        asyncio.create_task(run_model_process(config, model_event_queue))

        return {"success": True, "message": "Model run started."}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def run_model_process(config: ModelConfig, event_queue: asyncio.Queue):
    """
    Run the PyPSA model and send progress updates.
    """
    try:
        model = PyPSAModel(config)

        # In a real scenario, the model.run() would be asynchronous and yield progress
        # For this example, we'll simulate progress by reading the log file

        async def run_and_monitor():
            # Run the model in a separate thread
            model_thread = asyncio.to_thread(model.run)

            # Monitor the log file for changes
            log_file = Path(config.project_folder) / "Logs" / f"{config.scenario_name}_progress.json"
            last_log_content = ""

            while not model_thread.done():
                if log_file.exists():
                    with open(log_file, "r") as f:
                        current_log_content = f.read()

                    if current_log_content != last_log_content:
                        await event_queue.put({
                            "type": "progress",
                            "log": current_log_content
                        })
                        last_log_content = current_log_content

                await asyncio.sleep(1)

            # Final log check
            if log_file.exists():
                with open(log_file, "r") as f:
                    await event_queue.put({
                        "type": "progress",
                        "log": f.read()
                    })

            await event_queue.put({
                "type": "end",
                "status": "completed"
            })

        await run_and_monitor()

    except Exception as e:
        await event_queue.put({
            "type": "end",
            "status": "failed",
            "error": str(e)
        })
