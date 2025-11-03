"""
Complete Advanced Load Profile Generation System
Updated for New Unified JSON Configuration Format
"""

import pandas as pd
import numpy as np
import os
import json
import sys
import argparse
import traceback
from datetime import datetime, timedelta
import warnings
from pathlib import Path
import calendar
import time

# Set UTF-8 encoding
if sys.platform.startswith('win'):
    try:
        import codecs
        sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
        sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')
    except:
        pass

# Optional scipy imports
try:
    from scipy import stats, signal
    from scipy.interpolate import interp1d
    from scipy.signal import savgol_filter
    SCIPY_AVAILABLE = True
except ImportError:
    SCIPY_AVAILABLE = False
    stats = None
    signal = None

# Optional advanced libraries
STL_AVAILABLE = False
CLUSTERING_AVAILABLE = False
HOLIDAYS_AVAILABLE = False
WAVELET_AVAILABLE = False

try:
    from statsmodels.tsa.seasonal import STL, MSTL
    from statsmodels.tsa.stattools import acf, pacf
    from statsmodels.tsa.filters.hp_filter import hpfilter
    STL_AVAILABLE = True
except ImportError:
    pass

try:
    from sklearn.cluster import KMeans, DBSCAN
    from sklearn.preprocessing import StandardScaler
    from sklearn.decomposition import PCA
    from sklearn.ensemble import IsolationForest
    CLUSTERING_AVAILABLE = True
except ImportError:
    pass

try:
    import holidays
    HOLIDAYS_AVAILABLE = True
except ImportError:
    pass

try:
    import pywt  # For wavelet analysis
    WAVELET_AVAILABLE = True
except ImportError:
    pass

# Suppress warnings to avoid interfering with JSON output
warnings.filterwarnings('ignore')

def monthly_analysis(profile_df):
    monthly_analysis = ['Peak Demand', 'Min Demand', 'Average Demand', 'Monthly Load Factor','Total demand']
    result_rows = []

    # Get sorted list of months (numeric or string, depending on your data)
    months = sorted(profile_df['Month'].unique())

    # Loop through fiscal years
    for year in profile_df['Fiscal_Year'].unique():
        df_year = profile_df[profile_df['Fiscal_Year'] == year]
        
        # Monthly statistics with enforced month order
        df_sum = df_year.groupby('Month')['Demand_MW'].sum().reindex(months)
        df_mean = df_year.groupby('Month')['Demand_MW'].mean().reindex(months)
        df_min = df_year.groupby('Month')['Demand_MW'].min().reindex(months)
        df_max = df_year.groupby('Month')['Demand_MW'].max().reindex(months)
        df_load_factor = (df_mean / df_max).reindex(months)

        # Append rows for each analysis
        result_rows.append(['Peak Demand', year] + df_max.tolist())
        result_rows.append(['Min Demand', year] + df_min.tolist())
        result_rows.append(['Average Demand', year] + df_mean.tolist())
        result_rows.append(['Monthly Load Factor', year] + df_load_factor.tolist())
        result_rows.append(['Total demand', year] + df_sum.tolist())

    # Create column headers
    columns = ['Parameters', 'Fiscal_Year'] + list(months)

    # Build final DataFrame
    main_df = pd.DataFrame(result_rows, columns=columns)
    return main_df


def seasonal_analysis(profile_df):
    monthly_analysis = ['Peak Demand', 'Min Demand', 'Average Demand', 'Monthly Load Factor','Total Demand']
    result_rows = []

    # Get sorted list of months (numeric or string, depending on your data)
    months = sorted(profile_df['season'].unique())

    # Loop through fiscal years
    for year in profile_df['Fiscal_Year'].unique():
        df_year = profile_df[profile_df['Fiscal_Year'] == year]
        
        # Monthly statistics with enforced month order
        df_mean = df_year.groupby('season')['Demand_MW'].mean().reindex(months)
        df_min = df_year.groupby('season')['Demand_MW'].min().reindex(months)
        df_max = df_year.groupby('season')['Demand_MW'].max().reindex(months)
        df_sum = df_year.groupby('season')['Demand_MW'].sum().reindex(months)
        df_load_factor = (df_mean / df_max).reindex(months)

        # Append rows for each analysis
        result_rows.append(['Peak Demand', year] + df_max.tolist())
        result_rows.append(['Min Demand', year] + df_min.tolist())
        result_rows.append(['Average Demand', year] + df_mean.tolist())
        result_rows.append(['Monthly Load Factor', year] + df_load_factor.tolist())
        result_rows.append(['Total Demand', year] + df_sum.tolist())
    # Create column headers
    columns = ['Parameters', 'Fiscal_Year'] + list(months)

    # Build final DataFrame
    main_df = pd.DataFrame(result_rows, columns=columns)
    return main_df

def daily_profile(profile_df):
    monthly_analysis = ['Peak day Demand', 'Min Demand day', 'Average Demand']
    result_rows = []

    # Ensure columns are datetime-aware and sorted
    profile_df['DateTime'] = pd.to_datetime(profile_df['DateTime'])
    profile_df['date'] = profile_df['DateTime'].dt.date

    months = sorted(profile_df['Month'].unique())
    seasons = sorted(profile_df['season'].unique())
    hours = sorted(profile_df['Hour'].unique())

    for year in profile_df['Fiscal_Year'].unique():
        df_year = profile_df[profile_df['Fiscal_Year'] == year]

        # --- Monthly Analysis ---
        for month in months:
            df_month = df_year[df_year['Month'] == month]

            if df_month.empty:
                continue

            peak_day = df_month.loc[df_month['Demand_MW'].idxmax(), 'date']
            peak_day_profile = df_month[df_month['date'] == peak_day].sort_values('Hour')['Demand_MW'].tolist()

            min_day = df_month.loc[df_month['Demand_MW'].idxmin(), 'date']
            min_day_profile = df_month[df_month['date'] == min_day].sort_values('Hour')['Demand_MW'].tolist()

            avg_profile = df_month.groupby('Hour')['Demand_MW'].mean().reindex(hours).tolist()

            result_rows.append([monthly_analysis[0], year,peak_day, f"Month-{month}"] + peak_day_profile)
            result_rows.append([monthly_analysis[1], year,min_day , f"Month-{month}"] + min_day_profile)
            result_rows.append([monthly_analysis[2], year,'Average', f"Month-{month}"] + avg_profile)

        # --- Seasonal Analysis ---
        for season in seasons:
            df_season = df_year[df_year['season'] == season]

            if df_season.empty:
                continue

            peak_day = df_season.loc[df_season['Demand_MW'].idxmax(), 'date']
            peak_day_profile = df_season[df_season['date'] == peak_day].sort_values('Hour')['Demand_MW'].tolist()

            min_day = df_season.loc[df_season['Demand_MW'].idxmin(), 'date']
            min_day_profile = df_season[df_season['date'] == min_day].sort_values('Hour')['Demand_MW'].tolist()

            avg_profile = df_season.groupby('Hour')['Demand_MW'].mean().reindex(hours).tolist()

            result_rows.append([monthly_analysis[0], year,peak_day,  f"Season-{season}"] + peak_day_profile)
            result_rows.append([monthly_analysis[1], year,min_day, f"Season-{season}"] + min_day_profile)
            result_rows.append([monthly_analysis[2], year,'Average', f"Season-{season}"] + avg_profile)

    # Final DataFrame
    columns = ['Parameters', 'Fiscal_Year','Date', 'Type'] + hours
    main_df = pd.DataFrame(result_rows, columns=columns)
    return main_df

# FIX: This class now writes ONLY to sys.stderr
class ProgressReporter:
    """Progress reporting for WebSocket integration"""
    
    def __init__(self, enable_progress=True):
        self.enable_progress = enable_progress
        self.current_step = 0
        self.total_steps = 0
        
    def start_process(self, total_steps, process_name="Load Profile Generation"):
        self.total_steps = total_steps
        self.current_step = 0
        if self.enable_progress:
            try:
                sys.stderr.write(f"PROGRESS:{json.dumps({
                    'type': 'progress', 'step': 0, 'total_steps': total_steps,
                    'message': f'Starting {process_name}', 'percentage': 0
                })}\n")
                sys.stderr.flush()
            except Exception as e:
                sys.stderr.write(f"Progress reporting error: {e}\n")
    
    def update_progress(self, step_name, details=""):
        self.current_step += 1
        percentage = (self.current_step / self.total_steps) * 100 if self.total_steps > 0 else 0
        if self.enable_progress:
            try:
                sys.stderr.write(f"PROGRESS:{json.dumps({
                    'type': 'progress', 'step': self.current_step, 'total_steps': self.total_steps,
                    'message': step_name, 'details': details, 'percentage': round(percentage, 1)
                })}\n")
                sys.stderr.flush()
            except Exception as e:
                sys.stderr.write(f"Progress reporting error: {e}\n")
    
    def complete_process(self, message="Process completed successfully"):
        if self.enable_progress:
            try:
                sys.stderr.write(f"PROGRESS:{json.dumps({'type': 'completed', 'message': message, 'percentage': 100})}\n")
                sys.stderr.flush()
            except Exception as e:
                sys.stderr.write(f"Progress reporting error: {e}\n")

    def report_error(self, error_msg):
        try:
            sys.stderr.write(f"PROGRESS:{json.dumps({
                'type': 'error', 'message': error_msg, 'timestamp': datetime.now().isoformat()
            })}\n")
            sys.stderr.flush()
        except Exception as e:
            sys.stderr.write(f"Error reporting error: {e}\n")


class ComprehensivePatternExtractor:
    """Extract all patterns from historical data without assumptions"""
    
    def __init__(self, historical_data, config=None):
        self.data = historical_data.copy()
        self.config = config or {}
        self.patterns = {}
        self.validation_metrics = {}
        self.statistical_properties = {}
        
    def extract_all_patterns(self):
        """Extract comprehensive patterns from data"""
        print("\n" + "="*60, file=sys.stderr)
        print("COMPREHENSIVE PATTERN EXTRACTION", file=sys.stderr)
        print("="*60, file=sys.stderr)
        
        # Prepare data
        self._prepare_data()
        
        # Extract all pattern types
        self.patterns['temporal'] = self._extract_temporal_patterns()
        self.patterns['seasonal'] = self._extract_seasonal_patterns()
        self.patterns['base_load'] = self._extract_base_load_patterns()
        self.patterns['peak_characteristics'] = self._extract_peak_patterns()
        self.patterns['day_type'] = self._extract_day_type_patterns()
        self.patterns['transition'] = self._extract_transition_patterns()
        self.patterns['variability'] = self._extract_variability_patterns()
        self.patterns['correlations'] = self._extract_correlation_patterns()
        
        # Advanced pattern extraction if libraries available
        if STL_AVAILABLE:
            self.patterns['decomposition'] = self._extract_decomposition_patterns()
        
        if CLUSTERING_AVAILABLE:
            self.patterns['clusters'] = self._extract_cluster_patterns()
            
        if WAVELET_AVAILABLE:
            self.patterns['wavelet'] = self._extract_wavelet_patterns()
        
        # Calculate statistical properties
        self._calculate_statistical_properties()
        
        # Generate pattern report
        self._generate_pattern_report()
        
        return self.patterns
    
    def _prepare_data(self):
        """Prepare data with comprehensive datetime handling"""
        print("\nPreparing historical data...", file=sys.stderr)
        
        # Create datetime column
        if 'datetime' not in self.data.columns:
            if 'date' in self.data.columns and 'time' in self.data.columns:
                self.data['datetime'] = pd.to_datetime(
                    self.data['date'].astype(str) + ' ' + self.data['time'].astype(str),
                    errors='coerce'
                )
            elif 'date' in self.data.columns:
                self.data['datetime'] = pd.to_datetime(self.data['date'], errors='coerce')
        
        # Clean data
        self.data = self.data.dropna(subset=['datetime', 'demand'])
        self.data = self.data[self.data['demand'] > 0]
        self.data = self.data.sort_values('datetime')
        
        # Handle duplicates by averaging
        if self.data['datetime'].duplicated().any():
            self.data = self.data.groupby('datetime')['demand'].mean().reset_index()
        
        # Add comprehensive temporal features
        self.data['hour'] = self.data['datetime'].dt.hour
        self.data['dayofweek'] = self.data['datetime'].dt.dayofweek
        self.data['dayofyear'] = self.data['datetime'].dt.dayofyear
        self.data['weekofyear'] = self.data['datetime'].dt.isocalendar().week
        self.data['month'] = self.data['datetime'].dt.month
        self.data['quarter'] = self.data['datetime'].dt.quarter
        self.data['year'] = self.data['datetime'].dt.year
        
        # Fiscal year calculation (April-March)
        self.data['fiscal_year'] = np.where(
            self.data['datetime'].dt.month >= 4,
            self.data['datetime'].dt.year + 1,
            self.data['datetime'].dt.year
        )
        
        self.data['fiscal_month'] = ((self.data['datetime'].dt.month - 4) % 12) + 1
        
        # Day type classification
        self.data['is_weekend'] = self.data['dayofweek'].isin([5, 6]).astype(int)
        
        # Holiday detection
        if HOLIDAYS_AVAILABLE:
            try:
                years = range(self.data['year'].min(), self.data['year'].max() + 1)
                india_holidays = holidays.India(years=list(years))
                self.data['is_holiday'] = self.data['datetime'].dt.date.isin(india_holidays).astype(int)
            except:
                self.data['is_holiday'] = 0
        else:
            self.data['is_holiday'] = 0
        
        self.data['day_type'] = np.where(
            self.data['is_holiday'] == 1, 'holiday',
            np.where(self.data['is_weekend'] == 1, 'weekend', 'weekday')
        )
        
        # Season mapping for India
        season_map = {
            3: 'Summer', 4: 'Summer', 5: 'Summer', 6: 'Summer',
            7: 'Monsoon', 8: 'Monsoon', 9: 'Monsoon',
            10: 'Post-monsoon', 11: 'Post-monsoon',
            12: 'Winter', 1: 'Winter', 2: 'Winter'
        }
        self.data['season'] = self.data['month'].map(season_map)
        
        print(f"  Data range: {self.data['datetime'].min()} to {self.data['datetime'].max()}", file=sys.stderr)
        print(f"  Total records: {len(self.data):,}", file=sys.stderr)
        print(f"  Fiscal years: {sorted(self.data['fiscal_year'].unique())}", file=sys.stderr)
    
    def _extract_temporal_patterns(self):
        """Extract hourly, daily, weekly patterns"""
        print("\nExtracting temporal patterns...", file=sys.stderr)
        patterns = {}
        
        # Hourly patterns by day type
        hourly_patterns = {}
        for day_type in ['weekday', 'weekend', 'holiday']:
            subset = self.data[self.data['day_type'] == day_type]
            if len(subset) > 0:
                hourly_stats = subset.groupby('hour')['demand'].agg([
                    'mean', 'std', 'min', 'max', 'median',
                    lambda x: np.percentile(x, 25),  # Q1
                    lambda x: np.percentile(x, 75),  # Q3
                    lambda x: np.percentile(x, 5),   # P5
                    lambda x: np.percentile(x, 95)   # P95
                ]).reset_index()
                hourly_stats.columns = ['hour', 'mean', 'std', 'min', 'max', 
                                       'median', 'q1', 'q3', 'p5', 'p95']
                
                # Calculate shape factors (normalized pattern)
                if hourly_stats['mean'].sum() > 0:
                    hourly_stats['shape_factor'] = hourly_stats['mean'] / hourly_stats['mean'].mean()
                else:
                    hourly_stats['shape_factor'] = 1.0
                
                hourly_patterns[day_type] = hourly_stats
        
        patterns['hourly'] = hourly_patterns
        
        # Daily patterns (day of week effects)
        daily_patterns = self.data.groupby(['dayofweek', 'hour'])['demand'].agg([
            'mean', 'std', 'median'
        ]).reset_index()
        patterns['daily'] = daily_patterns
        
        # Weekly patterns
        weekly_stats = self.data.groupby('dayofweek')['demand'].agg([
            'mean', 'std', 'min', 'max', 'median'
        ]).reset_index()
        if weekly_stats['mean'].sum() > 0:
            weekly_stats['weekly_factor'] = weekly_stats['mean'] / weekly_stats['mean'].mean()
        patterns['weekly'] = weekly_stats
        
        # Intraday transitions (ramping rates)
        self.data['demand_change'] = self.data['demand'].diff()
        self.data['ramp_rate'] = self.data['demand_change'] / self.data['demand'].shift(1)
        
        ramp_stats = self.data.groupby('hour')['ramp_rate'].agg([
            'mean', 'std', 'min', 'max',
            lambda x: np.percentile(x.dropna(), 5),
            lambda x: np.percentile(x.dropna(), 95)
        ]).reset_index()
        ramp_stats.columns = ['hour', 'mean_ramp', 'std_ramp', 'min_ramp', 
                             'max_ramp', 'p5_ramp', 'p95_ramp']
        patterns['ramping'] = ramp_stats
        
        print(f"  ✓ Extracted patterns for {len(hourly_patterns)} day types", file=sys.stderr)
        if 'weekday' in hourly_patterns and len(hourly_patterns['weekday']) > 0:
            peak_hours = hourly_patterns['weekday'].nlargest(3, 'mean')['hour'].tolist()
            print(f"  ✓ Peak hours identified: {peak_hours}", file=sys.stderr)
        
        return patterns
    
    def _extract_seasonal_patterns(self):
        """Extract monthly and seasonal patterns"""
        print("\nExtracting seasonal patterns...", file=sys.stderr)
        patterns = {}
        
        # Monthly patterns (fiscal year basis)
        monthly_stats = self.data.groupby('fiscal_month')['demand'].agg([
            'mean', 'std', 'min', 'max', 'median',
            lambda x: np.percentile(x, 10),
            lambda x: np.percentile(x, 90)
        ]).reset_index()
        monthly_stats.columns = ['fiscal_month', 'mean', 'std', 'min', 'max', 
                                'median', 'p10', 'p90']
        
        # Calculate monthly factors
        if monthly_stats['mean'].sum() > 0:
            monthly_stats['monthly_factor'] = monthly_stats['mean'] / monthly_stats['mean'].mean()
        
        # Map to month names (fiscal year order)
        fiscal_month_names = {
            1: 'Apr', 2: 'May', 3: 'Jun', 4: 'Jul', 5: 'Aug', 6: 'Sep',
            7: 'Oct', 8: 'Nov', 9: 'Dec', 10: 'Jan', 11: 'Feb', 12: 'Mar'
        }
        monthly_stats['month_name'] = monthly_stats['fiscal_month'].map(fiscal_month_names)
        patterns['monthly'] = monthly_stats
        
        # Seasonal patterns (India-specific)
        seasonal_stats = self.data.groupby('season')['demand'].agg([
            'mean', 'std', 'min', 'max', 'median'
        ]).reset_index()
        if seasonal_stats['mean'].sum() > 0:
            seasonal_stats['seasonal_factor'] = seasonal_stats['mean'] / seasonal_stats['mean'].mean()
        patterns['seasonal'] = seasonal_stats
        
        # Year-over-year growth analysis
        yearly_stats = self.data.groupby('fiscal_year')['demand'].agg([
            'mean', 'sum', 'max'
        ]).reset_index()
        if len(yearly_stats) > 1:
            yearly_stats['growth_rate'] = yearly_stats['sum'].pct_change()
            yearly_stats['peak_growth'] = yearly_stats['max'].pct_change()
        patterns['yearly_growth'] = yearly_stats
        
        # Transition patterns between months
        monthly_transitions = {}
        for month in range(1, 13):
            next_month = (month % 12) + 1
            curr_data = self.data[self.data['fiscal_month'] == month]
            next_data = self.data[self.data['fiscal_month'] == next_month]
            
            if len(curr_data) > 0 and len(next_data) > 0:
                transition_factor = next_data['demand'].mean() / curr_data['demand'].mean()
                monthly_transitions[f"{month}_to_{next_month}"] = transition_factor
        
        patterns['monthly_transitions'] = monthly_transitions
        
        if len(monthly_stats) > 0:
            peak_months = monthly_stats.nlargest(3, 'mean')['month_name'].tolist()
            print(f"  ✓ Peak demand months: {peak_months}", file=sys.stderr)
        if len(seasonal_stats) > 0:
            print(f"  ✓ Seasonal variation: {seasonal_stats['seasonal_factor'].max():.2f} to {seasonal_stats['seasonal_factor'].min():.2f}", file=sys.stderr)
        
        return patterns
    
    def _extract_base_load_patterns(self):
        """Extract base load using multiple methodologies"""
        print("\nExtracting base load patterns...", file=sys.stderr)
        patterns = {}
        
        # Method 1: 5th percentile (research-validated)
        base_load_5th = np.percentile(self.data['demand'], 5)
        
        # Method 2: Minimum sustained load (bottom 5% average)
        bottom_5_percent = self.data.nsmallest(int(len(self.data) * 0.05), 'demand')['demand'].mean()
        
        # Method 3: Night-time minimum average (12 AM - 5 AM)
        night_hours = [0, 1, 2, 3, 4, 5]
        night_demand = self.data[self.data['hour'].isin(night_hours)]['demand']
        night_minimum = night_demand.mean() if len(night_demand) > 0 else base_load_5th
        
        # Method 4: Statistical mode of lower quartile
        lower_quartile = self.data[self.data['demand'] <= self.data['demand'].quantile(0.25)]
        if len(lower_quartile) > 0 and SCIPY_AVAILABLE and stats:
            try:
                kde = stats.gaussian_kde(lower_quartile['demand'])
                x_range = np.linspace(lower_quartile['demand'].min(), lower_quartile['demand'].max(), 1000)
                kde_values = kde(x_range)
                mode_value = x_range[np.argmax(kde_values)]
            except:
                mode_value = base_load_5th
        else:
            mode_value = base_load_5th
        
        # Base load by time periods
        base_load_hourly = self.data.groupby('hour')['demand'].apply(lambda x: np.percentile(x, 5))
        base_load_monthly = self.data.groupby('fiscal_month')['demand'].apply(lambda x: np.percentile(x, 5))
        base_load_seasonal = self.data.groupby('season')['demand'].apply(lambda x: np.percentile(x, 5))
        
        # Calculate ratios
        peak_demand = self.data['demand'].max()
        mean_demand = self.data['demand'].mean()
        
        patterns['metrics'] = {
            'base_load_5th_percentile': base_load_5th,
            'base_load_bottom_5_avg': bottom_5_percent,
            'base_load_night_minimum': night_minimum,
            'base_load_statistical_mode': mode_value,
            'base_load_ratio_5th': base_load_5th / peak_demand if peak_demand > 0 else 0,
            'base_load_ratio_mean': base_load_5th / mean_demand if mean_demand > 0 else 0,
            'peak_demand': peak_demand,
            'mean_demand': mean_demand
        }
        
        patterns['hourly_base'] = base_load_hourly.to_dict()
        patterns['monthly_base'] = base_load_monthly.to_dict()
        patterns['seasonal_base'] = base_load_seasonal.to_dict() if 'season' in self.data.columns else {}
        
        print(f"  ✓ Base load (5th percentile): {base_load_5th:.2f} MW", file=sys.stderr)
        print(f"  ✓ Base load ratio: {patterns['metrics']['base_load_ratio_5th']:.2%}", file=sys.stderr)
        
        return patterns
    
    def _extract_peak_patterns(self):
        """Extract peak demand characteristics"""
        print("\nExtracting peak demand patterns...", file=sys.stderr)
        patterns = {}
        
        # Overall peak analysis
        peak_idx = self.data['demand'].idxmax()
        peak_record = self.data.loc[peak_idx]
        
        patterns['absolute_peak'] = {
            'value': peak_record['demand'],
            'datetime': peak_record['datetime'],
            'hour': peak_record['hour'],
            'day_type': peak_record['day_type'],
            'month': peak_record['month'],
            'season': peak_record.get('season', 'Unknown')
        }
        
        # Daily peaks
        daily_peaks = self.data.groupby(self.data['datetime'].dt.date).agg({
            'demand': ['max', 'idxmax', 'mean']
        })
        daily_peaks.columns = ['daily_peak', 'peak_idx', 'daily_mean']
        daily_peaks['peak_hour'] = self.data.loc[daily_peaks['peak_idx']]['hour'].values
        daily_peaks['load_factor'] = daily_peaks['daily_mean'] / daily_peaks['daily_peak']
        
        patterns['daily_peaks'] = {
            'mean_peak': daily_peaks['daily_peak'].mean(),
            'std_peak': daily_peaks['daily_peak'].std(),
            'mean_peak_hour': daily_peaks['peak_hour'].mean(),
            'mode_peak_hour': daily_peaks['peak_hour'].mode()[0] if len(daily_peaks['peak_hour'].mode()) > 0 else daily_peaks['peak_hour'].mean(),
            'mean_daily_load_factor': daily_peaks['load_factor'].mean()
        }
        
        # Monthly peaks and load factors
        monthly_peaks = self.data.groupby(['fiscal_year', 'fiscal_month']).agg({
            'demand': ['max', 'mean', 'sum', 'count']
        })
        monthly_peaks.columns = ['peak', 'mean', 'total', 'hours']
        monthly_peaks['load_factor'] = monthly_peaks['mean'] / monthly_peaks['peak']
        monthly_peaks = monthly_peaks.reset_index()
        
        # Average monthly patterns
        avg_monthly_peaks = monthly_peaks.groupby('fiscal_month').agg({
            'peak': ['mean', 'std'],
            'load_factor': ['mean', 'std']
        })
        avg_monthly_peaks.columns = ['peak_mean', 'peak_std', 'lf_mean', 'lf_std']
        patterns['monthly_peaks'] = avg_monthly_peaks.to_dict()
        
        print(f"  ✓ Absolute peak: {patterns['absolute_peak']['value']:.2f} MW at hour {patterns['absolute_peak']['hour']}", file=sys.stderr)
        
        return patterns
    
    def _extract_day_type_patterns(self):
        """Extract patterns for different day types"""
        print("\nExtracting day type patterns...", file=sys.stderr)
        patterns = {}
        
        # Basic day type statistics
        day_type_stats = self.data.groupby('day_type')['demand'].agg([
            'mean', 'std', 'min', 'max', 'median', 'count'
        ])
        
        # Calculate reduction factors
        if 'weekday' in day_type_stats.index:
            weekday_mean = day_type_stats.loc['weekday', 'mean']
            day_type_stats['reduction_factor'] = day_type_stats['mean'] / weekday_mean
        
        patterns['basic_stats'] = day_type_stats.to_dict()
        
        # Hourly profiles by day type
        hourly_profiles = {}
        for day_type in self.data['day_type'].unique():
            subset = self.data[self.data['day_type'] == day_type]
            hourly_profile = subset.groupby('hour')['demand'].agg(['mean', 'std', 'median'])
            hourly_profiles[day_type] = hourly_profile.to_dict()
        
        patterns['hourly_profiles'] = hourly_profiles
        
        weekend_factor = patterns['basic_stats'].get('reduction_factor', {}).get('weekend', 'N/A')
        holiday_factor = patterns['basic_stats'].get('reduction_factor', {}).get('holiday', 'N/A')
        
        if isinstance(weekend_factor, (int, float)):
            print(f"  ✓ Weekend reduction factor: {weekend_factor:.2%}", file=sys.stderr)
        if isinstance(holiday_factor, (int, float)):
            print(f"  ✓ Holiday reduction factor: {holiday_factor:.2%}", file=sys.stderr)
        
        return patterns
    
    def _extract_transition_patterns(self):
        """Extract transition patterns between different time periods"""
        print("\nExtracting transition patterns...", file=sys.stderr)
        patterns = {}
        
        # Hour-to-hour transitions
        self.data['hour_transition'] = self.data['demand'].pct_change()
        hourly_transitions = self.data.groupby('hour')['hour_transition'].agg([
            'mean', 'std', 'min', 'max',
            lambda x: np.percentile(x.dropna(), 5),
            lambda x: np.percentile(x.dropna(), 95)
        ])
        hourly_transitions.columns = ['mean', 'std', 'min', 'max', 'p5', 'p95']
        patterns['hourly'] = hourly_transitions.to_dict()
        
        # Morning ramp-up pattern (5 AM to 10 AM)
        morning_data = self.data[self.data['hour'].isin(range(5, 11))]
        morning_ramp = morning_data.groupby('hour')['demand'].mean()
        if len(morning_ramp) > 1:
            morning_ramp_rate = (morning_ramp.iloc[-1] - morning_ramp.iloc[0]) / morning_ramp.iloc[0]
        else:
            morning_ramp_rate = 0
        
        # Evening peak pattern (5 PM to 10 PM)
        evening_data = self.data[self.data['hour'].isin(range(17, 23))]
        evening_pattern = evening_data.groupby('hour')['demand'].mean()
        
        night_hours_data = self.data[self.data['hour'].isin(range(0, 6))]
        night_valley = night_hours_data.groupby('hour')['demand'].mean()
        
        patterns['characteristic_periods'] = {
            'morning_ramp_rate': morning_ramp_rate,
            'morning_peak_hour': morning_ramp.idxmax() if len(morning_ramp) > 0 else 9,
            'evening_peak_hour': evening_pattern.idxmax() if len(evening_pattern) > 0 else 20,
            'night_valley_hour': night_valley.idxmin() if len(night_valley) > 0 else 3
        }
        
        print(f"  ✓ Morning ramp rate: {morning_ramp_rate:.2%}", file=sys.stderr)
        print(f"  ✓ Peak transition hours: Morning {patterns['characteristic_periods']['morning_peak_hour']}, Evening {patterns['characteristic_periods']['evening_peak_hour']}", file=sys.stderr)
        
        return patterns
    
    def _extract_variability_patterns(self):
        """Extract variability and volatility patterns"""
        print("\nExtracting variability patterns...", file=sys.stderr)
        patterns = {}
        
        # Overall variability metrics
        patterns['overall'] = {
            'coefficient_of_variation': self.data['demand'].std() / self.data['demand'].mean(),
            'interquartile_range': self.data['demand'].quantile(0.75) - self.data['demand'].quantile(0.25),
            'range': self.data['demand'].max() - self.data['demand'].min(),
            'variance': self.data['demand'].var(),
            'skewness': stats.skew(self.data['demand']) if SCIPY_AVAILABLE and stats else 0,
            'kurtosis': stats.kurtosis(self.data['demand']) if SCIPY_AVAILABLE and stats else 0
        }
        
        # Hourly variability
        hourly_cv = self.data.groupby('hour').apply(
            lambda x: x['demand'].std() / x['demand'].mean() if x['demand'].mean() > 0 else 0
        )
        patterns['hourly_cv'] = hourly_cv.to_dict()
        
        # Monthly variability
        monthly_cv = self.data.groupby('fiscal_month').apply(
            lambda x: x['demand'].std() / x['demand'].mean() if x['demand'].mean() > 0 else 0
        )
        patterns['monthly_cv'] = monthly_cv.to_dict()
        
        print(f"  ✓ Coefficient of variation: {patterns['overall']['coefficient_of_variation']:.3f}", file=sys.stderr)
        print(f"  ✓ Demand skewness: {patterns['overall']['skewness']:.3f}", file=sys.stderr)
        
        return patterns
    
    def _extract_correlation_patterns(self):
        """Extract temporal correlations and dependencies"""
        print("\nExtracting correlation patterns...", file=sys.stderr)
        patterns = {}
        
        # Autocorrelation analysis
        max_lags = min(168, len(self.data) // 4)  # Up to 1 week or 25% of data
        
        if STL_AVAILABLE and len(self.data) > max_lags:
            # Calculate ACF
            acf_values, acf_confint = acf(self.data['demand'], nlags=max_lags, alpha=0.05)
            
            # Find significant lags
            significant_lags = []
            for i in range(1, len(acf_values)):
                if acf_values[i] > acf_confint[i][1] or acf_values[i] < acf_confint[i][0]:
                    significant_lags.append(i)
            
            patterns['autocorrelation'] = {
                'lag_1h': acf_values[1] if len(acf_values) > 1 else 0,
                'lag_24h': acf_values[24] if len(acf_values) > 24 else 0,
                'lag_168h': acf_values[168] if len(acf_values) > 168 else 0,
                'significant_lags': significant_lags[:10]  # Top 10 significant lags
            }
            
            # Partial autocorrelation
            pacf_values = pacf(self.data['demand'], nlags=min(48, max_lags))
            patterns['partial_autocorrelation'] = {
                'lag_1h': pacf_values[1] if len(pacf_values) > 1 else 0,
                'lag_24h': pacf_values[24] if len(pacf_values) > 24 else 0
            }
        else:
            # Simple correlation calculation
            patterns['autocorrelation'] = {
                'lag_1h': self.data['demand'].autocorr(lag=1) if len(self.data) > 1 else 0,
                'lag_24h': self.data['demand'].autocorr(lag=24) if len(self.data) > 24 else 0,
                'lag_168h': self.data['demand'].autocorr(lag=168) if len(self.data) > 168 else 0
            }
        
        print(f"  ✓ 24-hour autocorrelation: {patterns['autocorrelation'].get('lag_24h', 0):.3f}", file=sys.stderr)
        print(f"  ✓ Weekly autocorrelation: {patterns['autocorrelation'].get('lag_168h', 0):.3f}", file=sys.stderr)
        
        return patterns
    
    def _extract_decomposition_patterns(self):
        """Extract patterns using STL decomposition"""
        if not STL_AVAILABLE:
            return {}
        
        print("\nExtracting STL decomposition patterns...", file=sys.stderr)
        patterns = {}
        
        try:
            # Prepare hourly time series
            hourly_data = self.data.set_index('datetime')['demand'].resample('H').mean()
            
            # Forward fill then backward fill for any missing values
            hourly_data = hourly_data.fillna(method='ffill').fillna(method='bfill')
            
            if len(hourly_data) < 2 * 168:  # Need at least 2 weeks
                print("  ⚠ Insufficient data for STL decomposition", file=sys.stderr)
                return patterns
            
            # Perform STL decomposition
            stl = STL(hourly_data, seasonal=169, trend=None, seasonal_deg=1, trend_deg=1)
            decomposition = stl.fit()
            
            patterns['components'] = {
                'trend_strength': 1 - (decomposition.resid.var() / (decomposition.resid + decomposition.trend).var()),
                'seasonal_strength': 1 - (decomposition.resid.var() / (decomposition.resid + decomposition.seasonal).var()),
                'residual_variance': decomposition.resid.var(),
                'trend_mean': decomposition.trend.mean(),
                'seasonal_amplitude': decomposition.seasonal.max() - decomposition.seasonal.min()
            }
            
            # Extract seasonal pattern
            seasonal_pattern = decomposition.seasonal[:168].values  # First week
            patterns['seasonal_pattern'] = seasonal_pattern.tolist()
            
            # Store full decomposition for generation
            patterns['trend'] = decomposition.trend.values.tolist()
            patterns['seasonal'] = decomposition.seasonal.values.tolist()
            patterns['residual'] = decomposition.resid.values.tolist()
            patterns['datetime_index'] = hourly_data.index.tolist()
            
            print(f"  ✓ Trend strength: {patterns['components']['trend_strength']:.3f}", file=sys.stderr)
            print(f"  ✓ Seasonal strength: {patterns['components']['seasonal_strength']:.3f}", file=sys.stderr)
            
        except Exception as e:
            print(f"  ⚠ STL decomposition failed: {e}", file=sys.stderr)
        
        return patterns
    
    def _extract_cluster_patterns(self):
        """Extract patterns using clustering techniques"""
        if not CLUSTERING_AVAILABLE:
            return {}
        
        print("\nExtracting cluster-based patterns...", file=sys.stderr)
        patterns = {}
        
        try:
            # Prepare daily profiles
            daily_profiles = self.data.pivot_table(
                index=self.data['datetime'].dt.date,
                columns='hour',
                values='demand',
                aggfunc='mean'
            )
            
            if len(daily_profiles) < 10:
                print("  ⚠ Insufficient data for clustering", file=sys.stderr)
                return patterns
            
            # Fill missing values
            daily_profiles = daily_profiles.fillna(daily_profiles.mean())
            
            # Standardize
            scaler = StandardScaler()
            scaled_profiles = scaler.fit_transform(daily_profiles)
            
            # Determine optimal number of clusters using elbow method
            inertias = []
            K_range = range(2, min(10, len(daily_profiles) // 5))
            for k in K_range:
                kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
                kmeans.fit(scaled_profiles)
                inertias.append(kmeans.inertia_)
            
            # Find elbow point (simplified)
            if len(inertias) > 2:
                deltas = np.diff(inertias)
                deltas2 = np.diff(deltas)
                elbow_idx = np.argmax(deltas2) + 2  # +2 because of double diff
                optimal_k = list(K_range)[elbow_idx]
            else:
                optimal_k = 3
            
            # Perform clustering with optimal k
            kmeans = KMeans(n_clusters=optimal_k, random_state=42, n_init=10)
            cluster_labels = kmeans.fit_predict(scaled_profiles)
            
            # Get cluster centers (in original scale)
            cluster_centers = scaler.inverse_transform(kmeans.cluster_centers_)
            
            # Analyze clusters
            cluster_info = {}
            for i in range(optimal_k):
                cluster_dates = daily_profiles.index[cluster_labels == i]
                cluster_data = self.data[self.data['datetime'].dt.date.isin(cluster_dates)]
                
                day_type_mode = cluster_data['day_type'].mode()
                season_mode = cluster_data['season'].mode() if 'season' in cluster_data.columns else pd.Series([])
                
                cluster_info[f'cluster_{i}'] = {
                    'size': len(cluster_dates),
                    'percentage': len(cluster_dates) / len(daily_profiles) * 100,
                    'mean_demand': cluster_data['demand'].mean(),
                    'peak_demand': cluster_data['demand'].max(),
                    'typical_profile': cluster_centers[i].tolist(),
                    'dominant_day_type': day_type_mode[0] if len(day_type_mode) > 0 else 'unknown',
                    'dominant_season': season_mode[0] if len(season_mode) > 0 else 'unknown'
                }
            
            patterns['clusters'] = cluster_info
            patterns['optimal_clusters'] = optimal_k
            
            print(f"  ✓ Identified {optimal_k} optimal clusters", file=sys.stderr)
            
        except Exception as e:
            print(f"  ⚠ Clustering failed: {e}", file=sys.stderr)
        
        return patterns
    
    def _extract_wavelet_patterns(self):
        """Extract patterns using wavelet analysis"""
        if not WAVELET_AVAILABLE:
            return {}
        
        print("\nExtracting wavelet-based patterns...", file=sys.stderr)
        patterns = {}
        
        try:
            # Use hourly demand data
            demand_signal = self.data['demand'].values
            
            # Perform discrete wavelet transform
            wavelet = 'db4'  # Daubechies 4
            level = min(4, int(np.log2(len(demand_signal))))
            
            coeffs = pywt.wavedec(demand_signal, wavelet, level=level)
            
            # Analyze energy distribution
            energy_by_level = []
            for i, coeff in enumerate(coeffs):
                energy = np.sum(coeff**2)
                energy_by_level.append(energy)
            
            total_energy = sum(energy_by_level)
            energy_distribution = [e/total_energy for e in energy_by_level]
            
            patterns['energy_distribution'] = {
                f'level_{i}': energy for i, energy in enumerate(energy_distribution)
            }
            
            print(f"  ✓ Wavelet decomposition completed with {level} levels", file=sys.stderr)
            
        except Exception as e:
            print(f"  ⚠ Wavelet analysis failed: {e}", file=sys.stderr)
        
        return patterns
    
    def _calculate_statistical_properties(self):
        """Calculate comprehensive statistical properties"""
        print("\nCalculating statistical properties...", file=sys.stderr)
        
        self.statistical_properties = {
            'demand_distribution': {
                'mean': self.data['demand'].mean(),
                'median': self.data['demand'].median(),
                'mode': self.data['demand'].mode()[0] if len(self.data['demand'].mode()) > 0 else self.data['demand'].median(),
                'std': self.data['demand'].std(),
                'variance': self.data['demand'].var(),
                'cv': self.data['demand'].std() / self.data['demand'].mean(),
                'skewness': stats.skew(self.data['demand']) if SCIPY_AVAILABLE and stats else 0,
                'kurtosis': stats.kurtosis(self.data['demand']) if SCIPY_AVAILABLE and stats else 0,
                'min': self.data['demand'].min(),
                'max': self.data['demand'].max(),
                'range': self.data['demand'].max() - self.data['demand'].min()
            },
            'percentiles': {
                'p1': self.data['demand'].quantile(0.01),
                'p5': self.data['demand'].quantile(0.05),
                'p10': self.data['demand'].quantile(0.10),
                'p25': self.data['demand'].quantile(0.25),
                'p50': self.data['demand'].quantile(0.50),
                'p75': self.data['demand'].quantile(0.75),
                'p90': self.data['demand'].quantile(0.90),
                'p95': self.data['demand'].quantile(0.95),
                'p99': self.data['demand'].quantile(0.99)
            },
            'load_factors': {
                'overall': self.data['demand'].mean() / self.data['demand'].max(),
                'monthly': self.data.groupby('fiscal_month').apply(
                    lambda x: x['demand'].mean() / x['demand'].max() if x['demand'].max() > 0 else 0
                ).to_dict()
            },
            'data_quality': {
                'total_records': len(self.data),
                'missing_hours': self._calculate_missing_hours(),
                'data_completeness': 1 - (self._calculate_missing_hours() / (len(self.data) + self._calculate_missing_hours())),
                'time_span_days': (self.data['datetime'].max() - self.data['datetime'].min()).days
            }
        }
        
        print(f"  ✓ Overall load factor: {self.statistical_properties['load_factors']['overall']:.3f}", file=sys.stderr)
        print(f"  ✓ Data completeness: {self.statistical_properties['data_quality']['data_completeness']:.1%}", file=sys.stderr)
    
    def _calculate_missing_hours(self):
        """Calculate number of missing hours in the dataset"""
        if len(self.data) < 2:
            return 0
        
        # Expected hours
        time_span = self.data['datetime'].max() - self.data['datetime'].min()
        expected_hours = int(time_span.total_seconds() / 3600) + 1
        
        # Actual hours
        actual_hours = len(self.data['datetime'].unique())
        
        return max(0, expected_hours - actual_hours)
    
    def _generate_pattern_report(self):
        """Generate comprehensive pattern report"""
        print("\n" + "="*60, file=sys.stderr)
        print("PATTERN EXTRACTION SUMMARY", file=sys.stderr)
        print("="*60, file=sys.stderr)
        
        # Key findings
        print("\nKey Patterns Identified:", file=sys.stderr)
        print(f"  • Base Load: {self.patterns['base_load']['metrics']['base_load_5th_percentile']:.2f} MW ({self.patterns['base_load']['metrics']['base_load_ratio_5th']:.1%} of peak)", file=sys.stderr)
        print(f"  • Peak Demand: {self.patterns['base_load']['metrics']['peak_demand']:.2f} MW", file=sys.stderr)
        print(f"  • Daily Peak Hours: Morning {self.patterns['transition']['characteristic_periods']['morning_peak_hour']}, Evening {self.patterns['transition']['characteristic_periods']['evening_peak_hour']}", file=sys.stderr)
        
        weekend_reduction = self.patterns['day_type']['basic_stats'].get('reduction_factor', {}).get('weekend', 1)
        if isinstance(weekend_reduction, (int, float)):
            print(f"  • Weekend Reduction: {(1 - weekend_reduction):.1%}", file=sys.stderr)
        
        print(f"\nData Quality:", file=sys.stderr)
        print(f"  • Time Span: {self.statistical_properties['data_quality']['time_span_days']} days", file=sys.stderr)
        print(f"  • Completeness: {self.statistical_properties['data_quality']['data_completeness']:.1%}", file=sys.stderr)
        print(f"  • Total Records: {self.statistical_properties['data_quality']['total_records']:,}", file=sys.stderr)
        
        print("\nStatistical Properties:", file=sys.stderr)
        print(f"  • Mean Demand: {self.statistical_properties['demand_distribution']['mean']:.2f} MW", file=sys.stderr)
        print(f"  • Std Deviation: {self.statistical_properties['demand_distribution']['std']:.2f} MW", file=sys.stderr)
        print(f"  • Coefficient of Variation: {self.statistical_properties['demand_distribution']['cv']:.3f}", file=sys.stderr)
        print(f"  • Skewness: {self.statistical_properties['demand_distribution']['skewness']:.3f}", file=sys.stderr)
        
        if 'decomposition' in self.patterns and self.patterns['decomposition']:
            print(f"\nDecomposition Analysis:", file=sys.stderr)
            print(f"  • Trend Strength: {self.patterns['decomposition']['components']['trend_strength']:.3f}", file=sys.stderr)
            print(f"  • Seasonal Strength: {self.patterns['decomposition']['components']['seasonal_strength']:.3f}", file=sys.stderr)
        
        if 'clusters' in self.patterns and self.patterns['clusters']:
            print(f"\nClustering Analysis:", file=sys.stderr)
            print(f"  • Optimal Clusters: {self.patterns['clusters']['optimal_clusters']}", file=sys.stderr)
        
        print("\n" + "="*60, file=sys.stderr)


def extract_simplified_patterns(historical_data, config):
    """Data-driven pattern extraction without hardcoded assumptions"""
    data = historical_data.copy()
    print("\nExtracting patterns from historical data (simplified mode)...", file=sys.stderr)
    
    # Basic data preparation
    if 'datetime' not in data.columns:
        if 'date' in data.columns and 'time' in data.columns:
            data['datetime'] = pd.to_datetime(
                data['date'].astype(str) + ' ' + data['time'].astype(str),
                errors='coerce'
            )
        elif 'date' in data.columns:
            data['datetime'] = pd.to_datetime(data['date'], errors='coerce')
    
    data = data.dropna(subset=['datetime', 'demand'])
    data = data[data['demand'] > 0]
    data = data.sort_values('datetime')
    
    # Handle duplicates by averaging
    if data['datetime'].duplicated().any():
        data = data.groupby('datetime')['demand'].mean().reset_index()
    
    print(f"  Data range: {data['datetime'].min()} to {data['datetime'].max()}", file=sys.stderr)
    print(f"  Total records: {len(data):,}", file=sys.stderr)
    
    # Add temporal features
    data['hour'] = data['datetime'].dt.hour
    data['month'] = data['datetime'].dt.month
    data['dayofweek'] = data['datetime'].dt.dayofweek
    data['dayofyear'] = data['datetime'].dt.dayofyear
    data['year'] = data['datetime'].dt.year
    data['fiscal_year'] = np.where(
        data['datetime'].dt.month >= 4,
        data['datetime'].dt.year + 1,
        data['datetime'].dt.year
    )
    data['fiscal_month'] = ((data['datetime'].dt.month - 4) % 12) + 1
    data['is_weekend'] = data['dayofweek'].isin([5, 6]).astype(int)
    
    # Holiday detection using actual data patterns
    data['is_holiday'] = 0
    
    # Method: Detect holidays by finding days with significantly lower demand
    weekday_avg = data[data['is_weekend'] == 0].groupby('dayofweek')['demand'].mean()
    
    holiday_candidates = []
    for dow in range(5):  # Monday to Friday
        if dow in weekday_avg.index:
            weekday_data = data[data['dayofweek'] == dow]
            daily_demand = weekday_data.groupby(weekday_data['datetime'].dt.date)['demand'].mean()
            
            # Find days with demand significantly below average
            threshold = weekday_avg[dow] - 1.5 * daily_demand.std()
            low_demand_dates = daily_demand[daily_demand < threshold].index
            
            for date in low_demand_dates:
                holiday_candidates.append(date)
    
    # Mark detected holidays
    if holiday_candidates:
        data.loc[data['datetime'].dt.date.isin(holiday_candidates), 'is_holiday'] = 1
        print(f"  Detected {len(set(holiday_candidates))} potential holidays from demand patterns", file=sys.stderr)
    
    # Create day_type classification
    data['day_type'] = np.where(
        data['is_holiday'] == 1, 'holiday',
        np.where(data['is_weekend'] == 1, 'weekend', 'weekday')
    )
    
    # Season mapping for India
    season_map = {
        3: 'Summer', 4: 'Summer', 5: 'Summer', 6: 'Summer',
        7: 'Monsoon', 8: 'Monsoon', 9: 'Monsoon',
        10: 'Post-monsoon', 11: 'Post-monsoon',
        12: 'Winter', 1: 'Winter', 2: 'Winter'
    }
    data['season'] = data['month'].map(season_map)
    
    # Extract temporal patterns
    print("  Analyzing temporal patterns...", file=sys.stderr)
    
    # Hourly patterns by day type
    hourly_patterns = {}
    for day_type in ['weekday', 'weekend', 'holiday']:
        subset = data[data['day_type'] == day_type]
        if len(subset) > 0:
            hourly_stats = subset.groupby('hour')['demand'].agg([
                'mean', 'std', 'min', 'max', 'median', 'count'
            ]).reset_index()
            
            # Calculate shape factors (normalized pattern)
            if hourly_stats['mean'].sum() > 0:
                hourly_stats['shape_factor'] = hourly_stats['mean'] / hourly_stats['mean'].mean()
            else:
                hourly_stats['shape_factor'] = 1.0
            
            hourly_patterns[day_type] = hourly_stats
            print(f"    {day_type}: {len(subset):,} records", file=sys.stderr)
    
    # Compile all patterns
    patterns = {
        'temporal': {
            'hourly': hourly_patterns
        },
        'seasonal': {
            'monthly': data.groupby('fiscal_month')['demand'].agg(['mean', 'std', 'min', 'max', 'median', 'count']).reset_index(),
            'yearly_growth': data.groupby('fiscal_year')['demand'].agg(['mean', 'sum', 'max', 'count']).reset_index()
        },
        'base_load': {
            'metrics': {
                'base_load_5th_percentile': np.percentile(data['demand'], 5),
                'peak_demand': data['demand'].max(),
                'mean_demand': data['demand'].mean()
            }
        },
        'day_type': {
            'basic_stats': {
                'reduction_factor': {
                    'weekend': data[data['day_type'] == 'weekend']['demand'].mean() / data[data['day_type'] == 'weekday']['demand'].mean() if len(data[data['day_type'] == 'weekday']) > 0 else 0.92,
                    'holiday': data[data['day_type'] == 'holiday']['demand'].mean() / data[data['day_type'] == 'weekday']['demand'].mean() if len(data[data['day_type'] == 'holiday']) > 0 and len(data[data['day_type'] == 'weekday']) > 0 else 0.85
                }
            },
            'hourly_profiles': {
                day_type: {
                    'mean': profile.set_index('hour')['mean'].to_dict() if 'mean' in profile.columns else {}
                } for day_type, profile in hourly_patterns.items()
            }
        },
        'transition': {
            'characteristic_periods': {
                'morning_peak_hour': 9,
                'evening_peak_hour': 20,
                'night_valley_hour': 3
            }
        }
    }
    
    # Add statistical properties
    patterns['statistical_properties'] = {
        'demand_distribution': {
            'mean': data['demand'].mean(),
            'std': data['demand'].std(),
            'cv': data['demand'].std() / data['demand'].mean() if data['demand'].mean() > 0 else 0,
            'min': data['demand'].min(),
            'max': data['demand'].max(),
            'median': data['demand'].median()
        },
        'load_factors': {
            'overall': data['demand'].mean() / data['demand'].max() if data['demand'].max() > 0 else 0,
            'monthly': data.groupby('fiscal_month').apply(
                lambda x: x['demand'].mean() / x['demand'].max() if x['demand'].max() > 0 else 0
            ).to_dict()
        },
        'data_quality': {
            'total_records': len(data),
            'data_completeness': 1.0,
            'time_span_days': (data['datetime'].max() - data['datetime'].min()).days
        }
    }
    
    print(f"\n✓ Pattern extraction completed", file=sys.stderr)
    
    return patterns


class AdvancedLoadProfileGenerator:
    """Advanced load profile generator supporting multiple methods"""
    
    def __init__(self, config, patterns, template_data):
        self.config = config
        self.patterns = patterns
        self.template_data = template_data
        self.statistical_properties = patterns.get('statistical_properties', {})
        self.progress = None
        
        # Parse the new unified configuration format
        self._parse_config()
        
        # Base year data (for normalized method)
        self.base_year_curve = None
        self.base_year_normalized = None
        self.monthly_targets = {}  # {(year, month): {'max': val, 'min': val}}
        
        # Results storage
        self.generated_profile = None
        self.validation_results = {}
        
    def _parse_config(self):
        """Parse the new unified JSON configuration format"""
        # Extract nested configuration values
        profile_config = self.config.get('profile_configuration', {})
        general_config = profile_config.get('general', {})
        method_config = profile_config.get('generation_method', {})
        data_source_config = profile_config.get('data_source', {})
        constraints_config = profile_config.get('constraints', {})
        
        # Parse general settings
        self.profile_name = general_config.get('profile_name', 'Generated_Profile')
        self.start_year = int(general_config.get('start_year', 2025))
        self.end_year = int(general_config.get('end_year', 2040))
        
        # Parse generation method
        self.method = method_config.get('type', 'base').lower()
        if self.method == 'base':
            self.method = 'normalized_pattern'
        elif self.method == 'stl':
            self.method = 'stl_decomposition'
        
        # Parse base year (only for base/normalized method)
        base_year_str = method_config.get('base_year')
        if base_year_str and base_year_str != 'null':
            # Handle FY2024 format or just 2024
            base_year_clean = base_year_str.replace('FY', '').strip()
            self.base_year = int(base_year_clean)
        else:
            # Default to last available year from historical data
            self.base_year = self._determine_default_base_year()
        
        # Parse data source
        self.data_source_type = data_source_config.get('type', 'template')
        self.scenario_name = data_source_config.get('scenario_name')
        
        # Parse constraints
        self.monthly_constraints = constraints_config.get('monthly_method', 'auto')
        
        # Initialize demand targets
        self.demand_targets = {}
        
        print(f"Configuration parsed:", file=sys.stderr)
        print(f"  Profile Name: {self.profile_name}", file=sys.stderr)
        print(f"  Years: {self.start_year} - {self.end_year}", file=sys.stderr)
        print(f"  Method: {self.method}", file=sys.stderr)
        print(f"  Base Year: {self.base_year}", file=sys.stderr)
        print(f"  Data Source: {self.data_source_type}", file=sys.stderr)
        if self.scenario_name:
            print(f"  Scenario: {self.scenario_name}", file=sys.stderr)
    
    def _determine_default_base_year(self):
        """Determine default base year from available historical data"""
        # Get historical data from template
        historical_data = self.template_data.get('Past_Hourly_Demand', pd.DataFrame())
        
        if not historical_data.empty:
            # Create datetime if needed
            data = historical_data.copy()
            if 'datetime' not in data.columns:
                if 'date' in data.columns and 'time' in data.columns:
                    data['datetime'] = pd.to_datetime(
                        data['date'].astype(str) + ' ' + data['time'].astype(str),
                        errors='coerce'
                    )
                elif 'date' in data.columns:
                    data['datetime'] = pd.to_datetime(data['date'], errors='coerce')
            
            if 'datetime' in data.columns:
                data = data.dropna(subset=['datetime'])
                data['fiscal_year'] = np.where(
                    data['datetime'].dt.month >= 4,
                    data['datetime'].dt.year + 1,
                    data['datetime'].dt.year
                )
                available_years = sorted(data['fiscal_year'].unique())
                if available_years:
                    return available_years[-1]  # Most recent year
        
        # Fallback
        return 2024
    
    def generate_profile(self):
        """Generate load profile using selected method"""
        print("\n" + "="*60, file=sys.stderr)
        print(f"ADVANCED LOAD PROFILE GENERATION - {self.method.upper()}", file=sys.stderr)
        print("="*60, file=sys.stderr)
        
        # Load demand targets
        if self.progress:
            self.progress.update_progress("Loading demand targets")
        self._load_demand_targets()
        
        # Generate profile structure
        if self.progress:
            self.progress.update_progress("Creating profile structure")
        profile_df = self._create_profile_structure()
        
        # Choose generation method
        if self.method == 'stl_decomposition' and STL_AVAILABLE:
            if self.progress:
                self.progress.update_progress("Applying STL decomposition method")
            profile_df = self._generate_stl_based_profile(profile_df)
        else:
            # Use normalized pattern method
            if self.progress:
                self.progress.update_progress("Extracting base year curve")
            self._extract_base_year_curve()
            
            if self.progress:
                self.progress.update_progress("Calculating monthly targets")
            self._calculate_monthly_targets()
            
            if self.progress:
                self.progress.update_progress("Normalizing base year curve")
            self._normalize_base_year_curve()
            
            if self.progress:
                self.progress.update_progress("Applying normalized patterns")
            profile_df = self._generate_normalized_pattern_profile(profile_df)
            
            if self.progress:
                self.progress.update_progress("Scaling to final targets")
            profile_df = self._scale_to_targets(profile_df)
        
        # Validate generated profile
        if self.progress:
            self.progress.update_progress("Validating generated profile")
        self._validate_generated_profile(profile_df)
        
        self.generated_profile = profile_df
        return profile_df
    
    def _load_demand_targets(self):
        """Load demand targets from template or forecast data"""
        print("\nLoading demand targets...", file=sys.stderr)
        
        if self.data_source_type == 'projection' and self.scenario_name:
            # Load from forecast scenario
            self.demand_targets = self._load_demand_targets_from_forecast()
        else:
            # Load from template
            if 'Total Demand' in self.template_data:
                df = self.template_data['Total Demand']
                df.columns = df.columns.str.strip()
                
                year_col = next((col for col in df.columns if 'year' in col.lower()), None)
                demand_col = next((col for col in df.columns if 'demand' in col.lower()), None)
                
                if year_col and demand_col:
                    for _, row in df.iterrows():
                        try:
                            year = int(float(row[year_col]))
                            demand = float(row[demand_col])
                            if self.start_year <= year <= self.end_year:
                                self.demand_targets[year] = demand
                                print(f"  FY{year}: {demand:,.0f} MWh", file=sys.stderr)
                        except (ValueError, TypeError):
                            continue
        
        if not self.demand_targets:
            print("  Warning: No demand targets loaded", file=sys.stderr)
        else:
            print(f"  Loaded targets for {len(self.demand_targets)} years", file=sys.stderr)
    
    def _load_demand_targets_from_forecast(self):
        """Load demand targets from forecast scenario"""
        project_path = self.config.get('project_path')
        
        if not project_path or not self.scenario_name:
            return {}
        
        forecast_path = os.path.join(project_path, 'results', 'forecasts', f"{self.scenario_name}.xlsx")
        
        if not os.path.exists(forecast_path):
            print(f"  Warning: Forecast file not found: {forecast_path}", file=sys.stderr)
            return {}
        
        try:
            forecast_data = pd.read_excel(forecast_path, sheet_name='Summary', engine='openpyxl')
            demand_targets = {}
            
            year_col = None
            demand_col = None
            
            for col in forecast_data.columns:
                col_lower = str(col).lower()
                if 'year' in col_lower or 'fy' in col_lower:
                    year_col = col
                elif 'total' in col_lower and ('demand' in col_lower or 'energy' in col_lower):
                    demand_col = col
            
            if year_col and demand_col:
                for _, row in forecast_data.iterrows():
                    try:
                        year_str = str(row[year_col]).replace('FY', '').strip()
                        year = int(float(year_str))
                        demand = float(row[demand_col])
                        
                        if self.start_year <= year <= self.end_year:
                            demand_targets[year] = demand
                            print(f"  FY{year}: {demand:,.0f} MWh", file=sys.stderr)
                    except (ValueError, TypeError):
                        continue
        except Exception as e:
            print(f"  Error loading forecast: {e}", file=sys.stderr)
            return {}
        
        return demand_targets
    
    def _generate_stl_based_profile(self, profile_df):
        """Generate profile using STL decomposition approach"""
        print("\nGenerating STL-based profile...", file=sys.stderr)
        
        if 'decomposition' not in self.patterns or not self.patterns['decomposition']:
            print("  ⚠ No STL decomposition available, falling back to pattern-based approach", file=sys.stderr)
            # Extract base year curve and use normalized method as fallback
            self._extract_base_year_curve()
            self._calculate_monthly_targets()
            self._normalize_base_year_curve()
            profile_df = self._generate_normalized_pattern_profile(profile_df)
            profile_df = self._scale_to_targets(profile_df)
            return profile_df
        
        # Get components from decomposition
        components = self.patterns['decomposition']['components']
        seasonal_pattern = self.patterns['decomposition'].get('seasonal_pattern', [])
        trend_values = self.patterns['decomposition'].get('trend', [])
        seasonal_values = self.patterns['decomposition'].get('seasonal', [])
        residual_values = self.patterns['decomposition'].get('residual', [])
        
        print(f"  STL components available: trend={len(trend_values)}, seasonal={len(seasonal_values)}, residual={len(residual_values)}", file=sys.stderr)
        
        # Calculate base scaling factors
        base_mean = components['trend_mean']
        base_amplitude = components['seasonal_amplitude']
        residual_std = np.sqrt(components['residual_variance'])
        
        # Initialize demand array
        demand = np.zeros(len(profile_df))
        
        for year in range(self.start_year, self.end_year + 1):
            year_mask = profile_df['Fiscal_Year'] == year
            year_indices = np.where(year_mask)[0]
            
            if len(year_indices) == 0:
                continue
            
            # Calculate annual scaling factor
            annual_growth_factor = self._calculate_annual_growth_factor(year)
            
            # Scale base components
            scaled_trend = base_mean * annual_growth_factor
            scaled_seasonal_amplitude = base_amplitude * annual_growth_factor
            scaled_residual_std = residual_std * np.sqrt(annual_growth_factor)  # Scale noise appropriately
            
            print(f"  Processing FY{year} with growth factor {annual_growth_factor:.3f}", file=sys.stderr)
            
            for idx in year_indices:
                row = profile_df.iloc[idx]
                
                # Get day of year for seasonal mapping
                fiscal_day = self._get_fiscal_day_of_year(row['DateTime'])
                
                # Map to original seasonal pattern (168 hours = 1 week cycle)
                seasonal_idx = (fiscal_day * 24 + row['Hour']) % 168
                
                # Get seasonal component
                if seasonal_pattern and len(seasonal_pattern) > seasonal_idx:
                    seasonal_component = seasonal_pattern[seasonal_idx] * (scaled_seasonal_amplitude / base_amplitude) if base_amplitude > 0 else 0
                else:
                    seasonal_component = 0
                
                # Apply day type modifications
                day_type_factor = 1.0
                day_type_patterns = self.patterns.get('day_type', {})
                day_type_factors = day_type_patterns.get('basic_stats', {}).get('reduction_factor', {})
                
                if row['day_type'] == 'weekend' and 'weekend' in day_type_factors:
                    day_type_factor = day_type_factors['weekend']
                elif row['day_type'] == 'holiday' and 'holiday' in day_type_factors:
                    day_type_factor = day_type_factors['holiday']
                
                # Combine components
                base_demand = scaled_trend + seasonal_component
                
                # Apply day type adjustment
                adjusted_demand = base_demand * day_type_factor
                
                # Add controlled noise
                noise = np.random.normal(0, scaled_residual_std * 0.3)  # Reduced noise
                final_demand = adjusted_demand + noise
                
                # Ensure positive values
                demand[idx] = max(final_demand, scaled_trend * 0.1)  # Minimum 10% of trend
        
        profile_df['Demand_MW'] = demand
        
        # Apply annual energy scaling
        for year in range(self.start_year, self.end_year + 1):
            if year in self.demand_targets:
                year_mask = profile_df['Fiscal_Year'] == year
                if np.sum(year_mask) > 0:
                    current_total = profile_df.loc[year_mask, 'Demand_MW'].sum()
                    target_total = self.demand_targets[year]
                    
                    if current_total > 0:
                        scale_factor = target_total / current_total
                        profile_df.loc[year_mask, 'Demand_MW'] *= scale_factor
                        print(f"  FY{year}: Scaled by {scale_factor:.4f} to meet target {target_total:,.0f} MWh", file=sys.stderr)
        
        print(f"  STL-based demand range: {profile_df['Demand_MW'].min():.2f} - {profile_df['Demand_MW'].max():.2f} MW", file=sys.stderr)
        
        return profile_df
    
    def _get_fiscal_day_of_year(self, dt):
        """Get fiscal day of year (April 1 = day 0)"""
        if dt.month >= 4:
            # April to December of same calendar year
            april_1 = datetime(dt.year, 4, 1)
        else:
            # January to March of next calendar year
            april_1 = datetime(dt.year - 1, 4, 1)
        
        return (dt - april_1).days
    
    def _calculate_annual_growth_factor(self, year):
        """Calculate annual growth factor for a given year"""
        years_from_base = year - self.base_year
        
        # Get growth rate from patterns or default
        growth_rate = 0.03  # Default 3% annual growth
        
        yearly_growth = self.patterns.get('seasonal', {}).get('yearly_growth', pd.DataFrame())
        if not yearly_growth.empty and 'growth_rate' in yearly_growth.columns:
            avg_growth = yearly_growth['growth_rate'].mean()
            if not pd.isna(avg_growth) and abs(avg_growth) < 0.2:  # Sanity check
                growth_rate = avg_growth
        
        # Apply compound growth
        growth_factor = (1 + growth_rate) ** years_from_base
        
        # Scale based on annual targets if available
        if year in self.demand_targets and hasattr(self, 'base_year_curve') and self.base_year_curve is not None:
            base_year_total = self.base_year_curve['demand'].sum()
            target_total = self.demand_targets[year]
            target_growth_factor = target_total / base_year_total
            
            # Use the target-based factor if it's reasonable
            if 0.5 < target_growth_factor < 3.0:  # Sanity check
                growth_factor = target_growth_factor
        
        return growth_factor
    
    def _extract_base_year_curve(self):
        """Extract hourly demand curve for the base year"""
        print(f"\nExtracting base year curve (FY{self.base_year})...", file=sys.stderr)
        
        # Get historical data from template
        historical_data = self.template_data.get('Past_Hourly_Demand', pd.DataFrame())
        
        if historical_data.empty:
            raise ValueError("No historical data found in template")
        
        # Prepare historical data
        data = historical_data.copy()
        
        # Create datetime column
        if 'datetime' not in data.columns:
            if 'date' in data.columns and 'time' in data.columns:
                data['datetime'] = pd.to_datetime(
                    data['date'].astype(str) + ' ' + data['time'].astype(str),
                    errors='coerce'
                )
            elif 'date' in data.columns:
                data['datetime'] = pd.to_datetime(data['date'], errors='coerce')
        
        # Clean data
        data = data.dropna(subset=['datetime', 'demand'])
        data = data[data['demand'] > 0]
        data = data.sort_values('datetime')
        
        # Handle duplicates by averaging
        if data['datetime'].duplicated().any():
            data = data.groupby('datetime')['demand'].mean().reset_index()
        
        # Add fiscal year
        data['fiscal_year'] = np.where(
            data['datetime'].dt.month >= 4,
            data['datetime'].dt.year + 1,
            data['datetime'].dt.year
        )
        
        # Extract base year data
        base_year_data = data[data['fiscal_year'] == self.base_year].copy()
        
        if base_year_data.empty:
            # If exact base year not available, use the most recent complete year
            available_years = sorted(data['fiscal_year'].unique())
            if available_years:
                self.base_year = available_years[-1]
                base_year_data = data[data['fiscal_year'] == self.base_year].copy()
                print(f"  Using FY{self.base_year} as base year (most recent available)", file=sys.stderr)
            else:
                raise ValueError("No complete fiscal year data available")
        
        # Sort by datetime and create complete hourly series
        base_year_data = base_year_data.sort_values('datetime')
        
        # Create complete hourly range for base year
        start_date = datetime(self.base_year - 1, 4, 1, 0, 0, 0)
        end_date = datetime(self.base_year, 3, 31, 23, 0, 0)
        complete_range = pd.date_range(start=start_date, end=end_date, freq='H')
        
        # Create complete base year DataFrame
        complete_base = pd.DataFrame({'datetime': complete_range})
        complete_base = complete_base.merge(
            base_year_data[['datetime', 'demand']], 
            on='datetime', 
            how='left'
        )
        
        # Fill missing values using interpolation
        if complete_base['demand'].isna().any():
            print(f"  Filling {complete_base['demand'].isna().sum()} missing hours using interpolation", file=sys.stderr)
            complete_base['demand'] = complete_base['demand'].interpolate(method='linear')
            complete_base['demand'] = complete_base['demand'].fillna(method='bfill').fillna(method='ffill')
        
        # Store base year curve
        self.base_year_curve = complete_base.copy()
        
        print(f"  Base year curve extracted: {len(self.base_year_curve)} hours", file=sys.stderr)
        print(f"  Base year range: {self.base_year_curve['demand'].min():.2f} - {self.base_year_curve['demand'].max():.2f} MW", file=sys.stderr)
        print(f"  Base year mean: {self.base_year_curve['demand'].mean():.2f} MW", file=sys.stderr)
        
        return self.base_year_curve
    
    def _calculate_monthly_targets(self):
        """Calculate monthly min/max targets from constraints or patterns"""
        print("\nCalculating monthly min/max targets...", file=sys.stderr)
        
        # Load constraints if available
        max_demand_constraints = pd.DataFrame()
        load_factor_constraints = pd.DataFrame()
        
        if self.monthly_constraints == 'excel':
            max_demand_constraints = self.template_data.get('max_demand', pd.DataFrame())
            load_factor_constraints = self.template_data.get('load_factor', pd.DataFrame())
        
        # Calculate targets for each year and month
        for year in range(self.start_year, self.end_year + 1):
            # Get annual growth factor
            annual_growth_factor = self._calculate_annual_growth_factor(year)
            
            for fiscal_month in range(1, 13):
                # Calculate base max demand for this month
                base_max = self._get_base_month_max(fiscal_month)
                
                # Calculate base min demand for this month
                base_min = self._get_base_month_min(fiscal_month)
                
                # Apply growth
                target_max = base_max * annual_growth_factor
                target_min = base_min * annual_growth_factor
                
                # Override with Excel constraints if available
                if not max_demand_constraints.empty:
                    excel_max = self._get_excel_constraint(
                        max_demand_constraints, year, fiscal_month
                    )
                    if excel_max is not None:
                        target_max = excel_max
                
                # Store targets
                self.monthly_targets[(year, fiscal_month)] = {
                    'max': target_max,
                    'min': target_min
                }
                
                month_names = ['', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 
                              'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar']
                print(f"  FY{year} {month_names[fiscal_month]}: Max={target_max:.1f} MW, Min={target_min:.1f} MW", file=sys.stderr)
        
        print(f"  Calculated targets for {len(self.monthly_targets)} month-year combinations", file=sys.stderr)
    
    def _get_base_month_max(self, fiscal_month):
        """Get base month maximum demand from base year curve"""
        # Add fiscal month to base year curve
        base_curve = self.base_year_curve.copy()
        base_curve['fiscal_month'] = ((base_curve['datetime'].dt.month - 4) % 12) + 1
        
        # Get max for this fiscal month
        month_data = base_curve[base_curve['fiscal_month'] == fiscal_month]
        if not month_data.empty:
            return month_data['demand'].max()
        else:
            # Fallback to overall max
            return base_curve['demand'].max()
    
    def _get_base_month_min(self, fiscal_month):
        """Get base month minimum demand from base year curve"""
        # Add fiscal month to base year curve
        base_curve = self.base_year_curve.copy()
        base_curve['fiscal_month'] = ((base_curve['datetime'].dt.month - 4) % 12) + 1
        
        # Get typical minimum for this fiscal month (5th percentile)
        month_data = base_curve[base_curve['fiscal_month'] == fiscal_month]
        if not month_data.empty:
            return np.percentile(month_data['demand'], 5)
        else:
            # Fallback to overall 5th percentile
            return np.percentile(base_curve['demand'], 5)
    
    def _get_excel_constraint(self, constraints_df, year, fiscal_month):
        """Get constraint value from Excel data"""
        # Find row for this year
        year_row = constraints_df[
            (constraints_df.get('financial_year', constraints_df.get('Year', 0)) == year)
        ]
        
        if year_row.empty:
            return None
        
        # Get month name
        month_names = {1: 'Apr', 2: 'May', 3: 'Jun', 4: 'Jul', 5: 'Aug', 6: 'Sep',
                      7: 'Oct', 8: 'Nov', 9: 'Dec', 10: 'Jan', 11: 'Feb', 12: 'Mar'}
        month_name = month_names[fiscal_month]
        
        if month_name in year_row.columns:
            value = year_row[month_name].iloc[0]
            if not pd.isna(value) and value > 0:
                return float(value)
        
        return None
    
    def _normalize_base_year_curve(self):
        """Normalize base year curve to [0, 1] range"""
        print("\nNormalizing base year curve...", file=sys.stderr)
        
        demand = self.base_year_curve['demand'].values
        
        # Calculate global min and max
        D_min_base = demand.min()
        D_max_base = demand.max()
        
        print(f"  Base year range: {D_min_base:.2f} - {D_max_base:.2f} MW", file=sys.stderr)
        
        # Normalize to [0, 1]
        if D_max_base > D_min_base:
            normalized_demand = (demand - D_min_base) / (D_max_base - D_min_base)
        else:
            normalized_demand = np.ones_like(demand) * 0.5  # Fallback for constant demand
        
        # Store normalized curve
        self.base_year_normalized = self.base_year_curve.copy()
        self.base_year_normalized['demand_normalized'] = normalized_demand
        
        print(f"  Normalized range: {normalized_demand.min():.3f} - {normalized_demand.max():.3f}", file=sys.stderr)
        print(f"  Normalized mean: {normalized_demand.mean():.3f}", file=sys.stderr)
        
        return self.base_year_normalized
    
    def _create_profile_structure(self):
        """Create the base profile DataFrame structure"""
        print("\nCreating profile structure...", file=sys.stderr)
        
        # Generate fiscal year date range
        start_date = datetime(self.start_year - 1, 4, 1, 0, 0, 0)
        end_date = datetime(self.end_year, 3, 31, 23, 0, 0)
        date_range = pd.date_range(start=start_date, end=end_date, freq='H')
        
        # Create DataFrame
        profile_df = pd.DataFrame({
            'DateTime': date_range,
            'Year': date_range.year,
            'Month': date_range.month,
            'Day': date_range.day,
            'Hour': date_range.hour,
            'DayOfWeek': date_range.dayofweek,
            'Fiscal_Year': [self._get_fiscal_year(dt) for dt in date_range]
        })
        
        # Add additional features
        profile_df['fiscal_month'] = ((profile_df['Month'] - 4) % 12) + 1
        profile_df['is_weekend'] = profile_df['DayOfWeek'].isin([5, 6]).astype(int)
        
        # Add seasons
        season_map = {
            3: 'Summer', 4: 'Summer', 5: 'Summer', 6: 'Summer',
            7: 'Monsoon', 8: 'Monsoon', 9: 'Monsoon',
            10: 'Post-monsoon', 11: 'Post-monsoon',
            12: 'Winter', 1: 'Winter', 2: 'Winter'
        }
        profile_df['season'] = profile_df['Month'].map(season_map)
        
        # Holiday detection
        profile_df['is_holiday'] = 0
        if HOLIDAYS_AVAILABLE:
            try:
                years = range(profile_df['Year'].min(), profile_df['Year'].max() + 1)
                india_holidays = holidays.India(years=list(years))
                profile_df['is_holiday'] = profile_df['DateTime'].dt.date.isin(india_holidays).astype(int)
            except:
                pass
        
        profile_df['day_type'] = np.where(
            profile_df['is_holiday'] == 1, 'holiday',
            np.where(profile_df['is_weekend'] == 1, 'weekend', 'weekday')
        )
        
        print(f"  Created {len(profile_df):,} hourly records", file=sys.stderr)
        print(f"  Date range: {profile_df['DateTime'].min()} to {profile_df['DateTime'].max()}", file=sys.stderr)
        
        return profile_df
    
    def _get_fiscal_year(self, dt):
        """Get fiscal year from datetime"""
        return dt.year + 1 if dt.month >= 4 else dt.year
    
    def _generate_normalized_pattern_profile(self, profile_df):
        """Generate profile using normalized base-year approach with pattern adjustments"""
        print("\nGenerating normalized pattern-based profile...", file=sys.stderr)
        
        # Create mapping from base year to all years
        base_curve = self.base_year_normalized.copy()
        base_curve['hour'] = base_curve['datetime'].dt.hour
        base_curve['fiscal_month'] = ((base_curve['datetime'].dt.month - 4) % 12) + 1
        base_curve['dayofweek'] = base_curve['datetime'].dt.dayofweek
        
        # For each year in the target profile, map from base year
        demand_normalized = np.zeros(len(profile_df))
        
        # Calculate year progress reporting
        years_to_process = list(range(self.start_year, self.end_year + 1))
        total_years = len(years_to_process)
        
        for year_idx, year in enumerate(years_to_process):
            year_mask = profile_df['Fiscal_Year'] == year
            year_indices = np.where(year_mask)[0]
            
            if len(year_indices) == 0:
                continue
            
            # Report detailed year progress
            completed_years = year_idx
            remaining_years = total_years - year_idx - 1
            
            print(f"  Processing FY{year}...", file=sys.stderr)
            
            # Send detailed progress update via stderr
            sys.stderr.write(f"YEAR_PROGRESS: Processing FY{year} ({year_idx + 1}/{total_years}) - "
                           f"Completed: {completed_years}, Current: FY{year}, Remaining: {remaining_years}\n")
            sys.stderr.flush()
            
            # Also update the main progress if available
            if self.progress:
                self.progress.update_progress(
                    f"Processing FY{year} ({year_idx + 1}/{total_years})",
                    f"Completed: {completed_years} years, Remaining: {remaining_years} years"
                )
            
            # Map each hour of this year to corresponding hour in base year
            for idx in year_indices:
                row = profile_df.iloc[idx]
                
                # Find corresponding hour in base year
                # Match by: fiscal_month, hour, and approximate day within month
                fiscal_month = row['fiscal_month']
                hour = row['Hour']
                day_of_month = row['Day']
                
                # Find matching hours in base year
                base_candidates = base_curve[
                    (base_curve['fiscal_month'] == fiscal_month) &
                    (base_curve['hour'] == hour)
                ]
                
                if len(base_candidates) > 0:
                    # If multiple candidates, pick the one with closest day of month
                    if len(base_candidates) > 1:
                        base_candidates = base_candidates.copy()
                        base_candidates['day'] = base_candidates['datetime'].dt.day
                        base_candidates['day_diff'] = abs(base_candidates['day'] - day_of_month)
                        best_match = base_candidates.loc[base_candidates['day_diff'].idxmin()]
                    else:
                        best_match = base_candidates.iloc[0]
                    
                    # Get normalized demand
                    base_normalized = best_match['demand_normalized']
                    
                    # Apply pattern adjustments in normalized space
                    adjusted_normalized = self._apply_pattern_adjustments(
                        base_normalized, row, year
                    )
                    
                    demand_normalized[idx] = adjusted_normalized
                else:
                    # Fallback: use mean normalized demand for this hour across all months
                    base_hour_candidates = base_curve[base_curve['hour'] == hour]
                    if len(base_hour_candidates) > 0:
                        demand_normalized[idx] = base_hour_candidates['demand_normalized'].mean()
                    else:
                        demand_normalized[idx] = 0.5  # Fallback
        
        # Store normalized demand
        profile_df['demand_normalized'] = demand_normalized
        
        print(f"  Normalized demand range: {demand_normalized.min():.3f} - {demand_normalized.max():.3f}", file=sys.stderr)
        print(f"  Normalized demand mean: {demand_normalized.mean():.3f}", file=sys.stderr)
        
        return profile_df
    
    def _apply_pattern_adjustments(self, base_normalized, row, year):
        """Apply pattern adjustments in normalized space"""
        adjusted = base_normalized
        
        # Get extracted patterns
        temporal_patterns = self.patterns.get('temporal', {})
        day_type_patterns = self.patterns.get('day_type', {})
        seasonal_patterns = self.patterns.get('seasonal', {})
        
        # Apply hourly shape factors
        hourly_patterns = temporal_patterns.get('hourly', {})
        day_type = row['day_type']
        hour = row['Hour']
        
        if day_type in hourly_patterns and not hourly_patterns[day_type].empty:
            hourly_data = hourly_patterns[day_type]
            if 'shape_factor' in hourly_data.columns:
                hour_data = hourly_data[hourly_data['hour'] == hour]
                if not hour_data.empty:
                    shape_factor = hour_data['shape_factor'].iloc[0]
                    # Apply shape factor with dampening to stay in normalized range
                    adjusted = adjusted * (0.5 + 0.5 * shape_factor)  # Dampen the effect
        
        # Apply day type adjustments (weekend/holiday reductions)
        day_type_factors = day_type_patterns.get('basic_stats', {}).get('reduction_factor', {})
        if day_type in day_type_factors:
            reduction_factor = day_type_factors[day_type]
            if isinstance(reduction_factor, (int, float)) and 0 < reduction_factor < 1:
                adjusted = adjusted * (0.7 + 0.3 * reduction_factor)  # Dampen reduction effect
        
        # Ensure we stay within [0, 1] bounds
        adjusted = np.clip(adjusted, 0.0, 1.0)
        
        return adjusted
    
    def _scale_to_targets(self, profile_df):
        """Scale normalized demand to final MW targets"""
        print("\nScaling to final MW targets...", file=sys.stderr)
        
        demand_final = np.zeros(len(profile_df))
        
        for year in range(self.start_year, self.end_year + 1):
            for fiscal_month in range(1, 13):
                # Get month mask
                mask = (profile_df['Fiscal_Year'] == year) & (profile_df['fiscal_month'] == fiscal_month)
                month_indices = np.where(mask)[0]
                
                if len(month_indices) == 0:
                    continue
                
                # Get targets for this month
                if (year, fiscal_month) in self.monthly_targets:
                    D_max = self.monthly_targets[(year, fiscal_month)]['max']
                    D_min = self.monthly_targets[(year, fiscal_month)]['min']
                else:
                    # Fallback to base year values with growth
                    growth_factor = self._calculate_annual_growth_factor(year)
                    D_max = self._get_base_month_max(fiscal_month) * growth_factor
                    D_min = self._get_base_month_min(fiscal_month) * growth_factor
                
                # Scale normalized demand to final range
                # d_final(t) = D_min + d_normalized(t) * (D_max - D_min)
                normalized_demand = profile_df.loc[mask, 'demand_normalized'].values
                scaled_demand = D_min + normalized_demand * (D_max - D_min)
                
                demand_final[month_indices] = scaled_demand
                
                month_names = ['', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 
                              'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar']
                print(f"  FY{year} {month_names[fiscal_month]}: {scaled_demand.min():.1f} - {scaled_demand.max():.1f} MW", file=sys.stderr)
        
        profile_df['Demand_MW'] = demand_final
        
        print(f"  Final demand range: {demand_final.min():.2f} - {demand_final.max():.2f} MW", file=sys.stderr)
        print(f"  Final demand mean: {demand_final.mean():.2f} MW", file=sys.stderr)
        
        return profile_df
    
    def _validate_generated_profile(self, profile_df):
        """Validate the generated profile against targets and constraints"""
        print("\nValidating generated profile...", file=sys.stderr)
        
        validation = {}
        
        # Annual energy validation
        for year in range(self.start_year, self.end_year + 1):
            year_mask = profile_df['Fiscal_Year'] == year
            if np.sum(year_mask) > 0:
                generated_total = profile_df.loc[year_mask, 'Demand_MW'].sum()
                target_total = self.demand_targets.get(year, generated_total)
                error_pct = abs(generated_total - target_total) / target_total * 100 if target_total > 0 else 0
                
                validation[f'FY{year}_energy'] = {
                    'generated': generated_total,
                    'target': target_total,
                    'error_pct': error_pct,
                    'pass': error_pct < 1.0  # 1% tolerance
                }
                
                print(f"  FY{year} Energy: {generated_total:,.0f} MWh (target: {target_total:,.0f}, error: {error_pct:.2f}%)", file=sys.stderr)
        
        # Overall statistics
        overall_lf = profile_df['Demand_MW'].mean() / profile_df['Demand_MW'].max() if profile_df['Demand_MW'].max() > 0 else 0
        validation['overall_load_factor'] = overall_lf
        
        validation['demand_statistics'] = {
            'min': profile_df['Demand_MW'].min(),
            'max': profile_df['Demand_MW'].max(),
            'mean': profile_df['Demand_MW'].mean(),
            'std': profile_df['Demand_MW'].std(),
            'cv': profile_df['Demand_MW'].std() / profile_df['Demand_MW'].mean() if profile_df['Demand_MW'].mean() > 0 else 0
        }
        
        self.validation_results = validation
        
        print(f"  Overall load factor: {overall_lf:.3f}", file=sys.stderr)
        print(f"  Demand range: {validation['demand_statistics']['min']:.1f} - {validation['demand_statistics']['max']:.1f} MW", file=sys.stderr)
        print("✓ Validation completed", file=sys.stderr)
        
        return validation


def main():
    """Main function for complete load profile generation"""
    parser = argparse.ArgumentParser(description='Complete Load Profile Generation System')
    parser.add_argument('--config', required=True, help='Configuration JSON string or file path')
    
    args = parser.parse_args()
    
    try:
        # Load configuration
        if os.path.exists(args.config):
            with open(args.config, 'r') as f:
                config = json.load(f)
        else:
            config = json.loads(args.config)
        
        # FIX: Initialize progress reporter to write to stderr
        progress = ProgressReporter(enable_progress=True)
        
        # FIX: All informational print() statements now go to stderr
        print("="*80, file=sys.stderr)
        print("COMPLETE LOAD PROFILE GENERATION SYSTEM", file=sys.stderr)
        print("="*80, file=sys.stderr)
        
        progress.start_process(8, "Complete Load Profile Generation")
        
        # Parse configuration method from new format
        profile_config = config.get('profile_configuration', {})
        method_config = profile_config.get('generation_method', {})
        method_type = method_config.get('type', 'base').lower()
        if method_type == 'base':
            method = 'normalized_pattern'
        elif method_type == 'stl':
            method = 'stl_decomposition'
        else:
            method = 'normalized_pattern'
        
        print(f"Method: {method}", file=sys.stderr)
        
        # Load template data
        progress.update_progress("Loading template data")
        
        project_path = config.get('project_path')
        template_path = os.path.join(project_path, 'inputs', 'load_curve_template.xlsx')
        
        try:
            template_data = pd.read_excel(template_path, sheet_name=None, engine='openpyxl')
        except Exception as e:
            print(f"Error loading template: {e}", file=sys.stderr)
            raise
        
        # Extract patterns based on method
        progress.update_progress("Extracting historical patterns")
        
        historical_data = template_data.get('Past_Hourly_Demand', pd.DataFrame())
        if historical_data.empty:
            raise ValueError("No historical data found in template")
        
        # Use comprehensive pattern extraction for STL method, simplified otherwise
        if method == 'stl_decomposition' and STL_AVAILABLE:
            pattern_extractor = ComprehensivePatternExtractor(historical_data, config)
            patterns = pattern_extractor.extract_all_patterns()
            patterns['statistical_properties'] = pattern_extractor.statistical_properties
        else:
            # Use simplified for normalized pattern method
            patterns = extract_simplified_patterns(historical_data, config)
        
        # Generate load profile
        progress.update_progress("Generating load profile")
        
        generator = AdvancedLoadProfileGenerator(config, patterns, template_data)
        generator.progress = progress
        profile_df = generator.generate_profile()
        
        # Save results
        progress.update_progress("Saving results")
        
        output_dir = os.path.join(project_path, 'results', 'load_profiles')
        os.makedirs(output_dir, exist_ok=True)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        method_suffix = "STL" if method == 'stl_decomposition' else "Normalized"
        scenario_name = generator.profile_name
        filename = f"{scenario_name}.xlsx"
        output_path = os.path.join(output_dir, filename)
        
        # Save to Excel with multiple sheets
        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            # Main profile
            profile_df.to_excel(writer, sheet_name='Load_Profile', index=False)
            monthly_analysis(profile_df).to_excel(writer, sheet_name='Monthly_analysis', index=False)
            seasonal_analysis(profile_df).to_excel(writer, sheet_name='Season_analysis', index=False)
            daily_profile(profile_df).to_excel(writer, sheet_name='Daily_analysis', index=False)
            
            # Summary sheet - Per Fiscal Year Statistics
            summary_data = []
            for fy in range(generator.start_year, generator.end_year + 1):
                fy_mask = profile_df['Fiscal_Year'] == fy
                if np.sum(fy_mask) > 0:
                    fy_data = profile_df.loc[fy_mask, 'Demand_MW']
                    summary_data.append({
                        'Fiscal_Year': f"FY{fy}",
                        'Peak_MW': f"{fy_data.max():.2f}",
                        'Average_MW': f"{fy_data.mean():.2f}",
                        'Min_MW': f"{fy_data.min():.2f}",
                        'Total_MWh': f"{fy_data.sum():.0f}",
                        'Load_Factor': f"{fy_data.mean() / fy_data.max():.3f}",
                        'Total_Hours': len(fy_data)
                    })
            
            if summary_data:
                pd.DataFrame(summary_data).to_excel(writer, sheet_name='Summary', index=False)
            
            # Validation results
            if generator.validation_results:
                validation_summary = []
                for key, value in generator.validation_results.items():
                    if isinstance(value, dict) and 'generated' in value and 'target' in value:
                        validation_summary.append({
                            'Metric': key,
                            'Generated': value['generated'],
                            'Target': value['target'],
                            'Error %': value.get('error_pct', 0),
                            'Pass': value.get('pass', True)
                        })
                
                if validation_summary:
                    pd.DataFrame(validation_summary).to_excel(writer, sheet_name='Validation', index=False)
            
            # Monthly statistics
            monthly_stats = []
            for fy in range(generator.start_year, generator.end_year + 1):
                for month in range(1, 13):
                    mask = (profile_df['Fiscal_Year'] == fy) & (profile_df['fiscal_month'] == month)
                    if np.sum(mask) > 0:
                        month_data = profile_df.loc[mask, 'Demand_MW']
                        fiscal_month_names = {1: 'Apr', 2: 'May', 3: 'Jun', 4: 'Jul', 5: 'Aug', 6: 'Sep',
                                            7: 'Oct', 8: 'Nov', 9: 'Dec', 10: 'Jan', 11: 'Feb', 12: 'Mar'}
                        monthly_stats.append({
                            'Fiscal_Year': fy,
                            'Month': fiscal_month_names[month],
                            'Peak_MW': month_data.max(),
                            'Average_MW': month_data.mean(),
                            'Min_MW': month_data.min(),
                            'Total_MWh': month_data.sum(),
                            'Load_Factor': month_data.mean() / month_data.max() if month_data.max() > 0 else 0
                        })
            
            if monthly_stats:
                pd.DataFrame(monthly_stats).to_excel(writer, sheet_name='Monthly_Statistics', index=False)
            
            # Pattern information sheet
            if method == 'stl_decomposition' and 'decomposition' in patterns:
                pattern_info = []
                decomp = patterns['decomposition']
                if 'components' in decomp:
                    components = decomp['components']
                    pattern_info.append({
                        'Pattern_Type': 'STL_Decomposition',
                        'Metric': 'Trend_Strength',
                        'Value': f"{components.get('trend_strength', 0):.3f}"
                    })
                    pattern_info.append({
                        'Pattern_Type': 'STL_Decomposition',
                        'Metric': 'Seasonal_Strength',
                        'Value': f"{components.get('seasonal_strength', 0):.3f}"
                    })
                    pattern_info.append({
                        'Pattern_Type': 'STL_Decomposition',
                        'Metric': 'Residual_Variance',
                        'Value': f"{components.get('residual_variance', 0):.3f}"
                    })
                
                if pattern_info:
                    pd.DataFrame(pattern_info).to_excel(writer, sheet_name='Pattern_Info', index=False)
            else:
                # Add normalized pattern information
                pattern_info = []
                pattern_info.append({
                    'Pattern_Type': 'Normalized_Base_Year',
                    'Metric': 'Base_Year',
                    'Value': f"FY{generator.base_year}"
                })
                if hasattr(generator, 'base_year_curve') and generator.base_year_curve is not None:
                    pattern_info.append({
                        'Pattern_Type': 'Normalized_Base_Year',
                        'Metric': 'Base_Year_Peak_MW',
                        'Value': f"{generator.base_year_curve['demand'].max():.2f}"
                    })
                    pattern_info.append({
                        'Pattern_Type': 'Normalized_Base_Year',
                        'Metric': 'Base_Year_Mean_MW',
                        'Value': f"{generator.base_year_curve['demand'].mean():.2f}"
                    })
                
                if pattern_info:
                    pd.DataFrame(pattern_info).to_excel(writer, sheet_name='Pattern_Info', index=False)
        
        progress.complete_process("Generation completed successfully")
        
        # Prepare result
        result = {
            'success': True,
            'output_file': output_path,
            'filename': filename,
            'total_hours': len(profile_df),
            'peak_demand': float(profile_df['Demand_MW'].max()),
            'average_demand': float(profile_df['Demand_MW'].mean()),
            'total_energy': float(profile_df['Demand_MW'].sum()),
            'method': method,
            'base_year': int(getattr(generator, 'base_year', 0)),
            'generation_timestamp': datetime.now().isoformat(),
            'profile_name': generator.profile_name
        }
        
        # Print final summary to stderr
        print("\n" + "="*80, file=sys.stderr)
        print("GENERATION COMPLETE", file=sys.stderr)
        print("="*80, file=sys.stderr)
        print(f"Profile: {result['profile_name']}", file=sys.stderr)
        print(f"Method: {result['method']}", file=sys.stderr)
        if result.get('base_year'):
            print(f"Base Year: FY{result['base_year']}", file=sys.stderr)
        print(f"Output: {filename}", file=sys.stderr)
        print(f"Total Hours: {result['total_hours']:,}", file=sys.stderr)
        print(f"Peak: {result['peak_demand']:.2f} MW", file=sys.stderr)
        print(f"Average: {result['average_demand']:.2f} MW", file=sys.stderr)
        print(f"Total Energy: {result['total_energy']:,.0f} MWh", file=sys.stderr)
        print(f"Load Factor: {result['average_demand']/result['peak_demand']:.3f}", file=sys.stderr)
        
        # FIX: The final JSON is the ONLY thing printed to standard stdout
        print(json.dumps(result))
        return result
        
    except Exception as e:
        # Report error through progress reporter (to stderr)
        progress = ProgressReporter(enable_progress=True)
        error_msg = f"Generation failed: {str(e)}"
        progress.report_error(error_msg)
        
        # Log detailed error to stderr
        sys.stderr.write(f"\nERROR: {str(e)}\n")
        sys.stderr.write(traceback.format_exc())
        sys.stderr.flush()
        
        # Output JSON error to stdout
        error_result = {
            'success': False,
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }
        print(json.dumps(error_result))
        return error_result


if __name__ == "__main__":
    result = main()
    sys.exit(0 if result.get('success') else 1)