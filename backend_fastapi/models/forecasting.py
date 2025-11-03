
"""
File: backend/src/python/forecasting.py
Path: backend/src/python/forecasting.py
Description: Stand-alone Demand Forecasting Script – KSEB Energy Futures Platform
             Reads the new JSON schema (array-of-sectors) transparently by
             remapping keys once at load time.  All downstream logic unchanged.
Usage:
    python forecasting.py --config config.json
"""

from typing import Any, Dict, List
import os, sys, json, argparse, warnings, numpy as np, pandas as pd, time
from datetime import datetime
from pathlib import Path

from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_percentage_error
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import GridSearchCV, TimeSeriesSplit
import xlsxwriter
from sklearn.svm import SVR
warnings.filterwarnings('ignore')
CONFIG = {}
TOTAL_STEPS = 0
CURRENT_STEP = 0
DEFAULT_CV_SPLITS = 3  # Default number of cross-validation splits for time series


# ------------------------------------------------------------------------------
# Progress & logging helpers (unchanged)
# ------------------------------------------------------------------------------
class ProgressReporter:
    def __init__(self, total_sectors=1):
        self.total_sectors = total_sectors
        self.current_sector_index = 0
        self.processed_sectors = 0
        self.start_time = time.time()
        self.sector_start_time = None
        self.current_sector = None

    def start_sector(self, sector_name):
        self.current_sector = sector_name
        self.sector_start_time = time.time()
        self.current_sector_index = self.processed_sectors
        data = dict(type="progress",
                    sector=sector_name,
                    current_sector_index=self.current_sector_index,
                    processed_sectors=self.processed_sectors,
                    total_sectors=self.total_sectors,
                    sector_progress=0,
                    progress=(self.processed_sectors / self.total_sectors) * 100,
                    message=f"Starting {sector_name} sector analysis...",
                    step="Sector Initialization",
                    timestamp=datetime.now().isoformat())
        self.emit_progress(data)

    def update_sector_progress(self, progress_percent, message="", step=""):
        if self.current_sector is None:
            return
        base = (self.processed_sectors / self.total_sectors) * 100
        overall = min(base + (progress_percent / 100) * (100 / self.total_sectors), 100)
        data = dict(type="progress",
                    sector=self.current_sector,
                    current_sector_index=self.current_sector_index,
                    processed_sectors=self.processed_sectors,
                    total_sectors=self.total_sectors,
                    sector_progress=progress_percent,
                    progress=overall,
                    message=message or f"Processing {self.current_sector}...",
                    step=step or "Processing",
                    timestamp=datetime.now().isoformat())
        self.emit_progress(data)

    def complete_sector(self):
        if self.current_sector is None:
            return
        self.processed_sectors += 1
        dur = time.time() - (self.sector_start_time or time.time())
        data = dict(type="sector_completed",
                    sector=self.current_sector,
                    processed_sectors=self.processed_sectors,
                    total_sectors=self.total_sectors,
                    progress=(self.processed_sectors / self.total_sectors) * 100,
                    sector_duration=dur,
                    message=f"Completed {self.current_sector} sector",
                    step="Sector Completed",
                    timestamp=datetime.now().isoformat())
        self.emit_progress(data)
        self.current_sector = None
        self.sector_start_time = None

    def emit_progress(self, progress_data):
        try:
            print(f"PROGRESS:{json.dumps(progress_data)}", flush=True)
        except Exception as e:
            print(f"Error emitting progress: {e}", file=sys.stderr)


def emit_progress(progress_data):
    try:
        print(f"PROGRESS:{json.dumps(progress_data)}", flush=True)
        sys.stdout.flush()
    except Exception as e:
        print(f"Error emitting progress: {e}", file=sys.stderr)


def log_info(msg):
    print(f"[{datetime.now():%Y-%m-%d %H:%M:%S}] INFO: {msg}", file=sys.stderr, flush=True)


def log_error(msg):
    print(f"[{datetime.now():%Y-%m-%d %H:%M:%S}] ERROR: {msg}", file=sys.stderr, flush=True)


def log_warning(msg):
    print(f"[{datetime.now():%Y-%m-%d %H:%M:%S}] WARNING: {msg}", file=sys.stderr, flush=True)


def report_progress(step, total_steps, message, sector_name=None, sector_progress=0):
    global CONFIG
    progress_percent = int((step / total_steps) * 100)
    enabled = [s for s, cfg in CONFIG.get('sectors', {}).items() if cfg.get('enabled', True)]
    idx = enabled.index(sector_name) if sector_name and sector_name in enabled else 0
    data = dict(type="progress",
                sector=sector_name,
                step=f"Step {step}/{total_steps}",
                message=message,
                progress=progress_percent,
                sector_progress=sector_progress,
                current_sector_index=idx,
                processed_sectors=idx,
                total_sectors=len(enabled),
                timestamp=datetime.now().isoformat())
    emit_progress(data)
    log_info(f"[{sector_name or 'Overall'}] Step {step}/{total_steps} ({progress_percent}%): {message}")


# ------------------------------------------------------------------------------
# CONFIGURATION LOADER
# ------------------------------------------------------------------------------
def load_config(path):
    try:
        with open(path, encoding='utf-8') as f:
            raw = json.load(f)

        # --- transparent mapping from new keys to internal keys -----------------
        config = {}
        config['scenario_name'] = raw.get('scenarioName') or raw.get('scenario_name')
        config['exclude_covid'] = raw.get('excludeCovidYears', raw.get('exclude_covid', True))
        config['target_year']   = int(raw.get('targetYear', raw.get('target_year', 2037)))
        config['forecast_path'] = raw.get('forecast_path', config['scenario_name'])
        config['global_models'] = raw.get('global_models', ['SLR', 'MLR'])
        config.setdefault('covid_years', [2020, 2021, 2022])
        config.setdefault('output_format', 'excel')
        config.setdefault('include_charts', True)

        # sectors section: convert array → dict keyed by name
        sectors_in = raw.get('sectors', [])
        if isinstance(sectors_in, list):
            sectors = {}
            for sec in sectors_in:
                name = sec['name']
                sectors[name] = {
                    'enabled': True,
                    'models': sec.get('selectedMethods', ['SLR']),
                    'parameters': {
                        'MLR': {'independent_vars': sec.get('mlrParameters', [])},
                        'WAM': {'window_size': sec.get('wamWindow', 10)}
                    },
                    'data': sec['data']
                }
        else:
            sectors = sectors_in  # already a dict, keep as-is

        config['sectors'] = sectors

        for k in ('scenario_name', 'target_year', 'sectors'):
            if k not in config or config[k] is None:
                raise ValueError(f"Missing required configuration field: {k}")

        log_info(f"Configuration loaded: {config['scenario_name']} | target={config['target_year']}")
        return config

    except FileNotFoundError:
        log_error(f"Config file not found: {path}")
        raise
    except json.JSONDecodeError as e:
        log_error(f"Invalid JSON: {e}")
        raise
    except Exception as e:
        log_error(f"Failed to load configuration: {e}")
        raise


# ------------------------------------------------------------------------------
# Data Processing and Forecasting Logic
# ------------------------------------------------------------------------------
def validate_sector_data(sector_name, sector_config):
    if 'data' not in sector_config:
        raise ValueError(f"No data provided for sector {sector_name}")
    data = sector_config['data']
    if not isinstance(data, list) or len(data) == 0:
        raise ValueError(f"Invalid or empty data for sector {sector_name}")
    df = pd.DataFrame(data)
    if 'Year' not in df.columns or 'Electricity' not in df.columns:
        raise ValueError(f"Missing required columns (Year, Electricity) in sector {sector_name}")
    if df['Year'].isnull().any():
        log_warning(f"Sector {sector_name} has missing Year values")
    if df['Electricity'].isnull().any():
        log_warning(f"Sector {sector_name} has missing Electricity values")
    return True


def prepare_sector_data(sector_name, sector_config):
    try:
        validate_sector_data(sector_name, sector_config)
        data = sector_config['data']
        df = pd.DataFrame(data)
        
        for col in df.columns:
            if col != 'Year':
                numeric_series = pd.to_numeric(df[col], errors='coerce')
                if not numeric_series.isna().all():
                    df[col] = numeric_series
        
        df['Year'] = pd.to_numeric(df['Year'], errors='coerce')
        df['Electricity'] = pd.to_numeric(df['Electricity'], errors='coerce')
        
        original_len = len(df)
        df = df.dropna(subset=['Year', 'Electricity'])
        if len(df) < original_len:
            log_warning(f"Removed {original_len - len(df)} invalid rows from {sector_name}")
        if len(df) == 0:
            raise ValueError(f"No valid data for sector {sector_name}")
        df = df.sort_values('Year').reset_index(drop=True)
        log_info(f"Prepared data for {sector_name}: {len(df)} rows, {df['Year'].min()}-{df['Year'].max()}")
        return df
    except Exception as e:
        log_error(f"Error preparing data for sector {sector_name}: {e}")
        raise


def weighted_average_forecast(df, forecast_years, window_size, exclude_covid=True):
    if window_size < 2:
        raise ValueError("window_size must be at least 2")
    df = df.copy().sort_values(by='Year').reset_index(drop=True)
    df['% increase'] = (df['Electricity'] / df['Electricity'].shift(1)) ** (1 / (df['Year'] - df['Year'].shift(1))) - 1
    if exclude_covid:
        covid_years = CONFIG.get('covid_years', [2020, 2021, 2022])
        original_len = len(df)
        df = df[~df['Year'].isin(covid_years)].copy()
        if len(df) < original_len:
            log_info(f"Filtered COVID years, {len(df)} remain")
    df_filtered = df.dropna(subset=['% increase'])
    actual_window_size = min(window_size, len(df_filtered))
    if actual_window_size == 0:
        raise ValueError("No valid growth rates for WAM")
    weights = np.arange(1, actual_window_size + 1) / np.arange(1, actual_window_size + 1).sum()
    weighted_growth_rate = np.average(df_filtered['% increase'].tail(actual_window_size), weights=weights)
    last_year = int(df['Year'].max())
    last_value = df.loc[df['Year'] == last_year, 'Electricity'].values[0]
    forecast_df = pd.DataFrame({'Year': range(last_year + 1, int(forecast_years) + 1)})
    forecast_values = [last_value * (1 + weighted_growth_rate) ** i for i in range(1, len(forecast_df) + 1)]
    forecast_df['Electricity'] = forecast_values
    result_df = pd.concat([df[['Year', 'Electricity']], forecast_df], ignore_index=True)
    return result_df


def prepare_ml_data(df, independent_vars, target_year, exclude_covid=True):
    df = df.copy()
    if exclude_covid:
        covid_years = CONFIG.get('covid_years', [2020, 2021, 2022])
        original_len = len(df)
        df = df[~df['Year'].isin(covid_years)].copy()
        if len(df) < original_len:
            log_info(f"Excluded COVID years for ML training: {original_len - len(df)} rows removed")
    df = df.sort_values('Year').reset_index(drop=True)
    unique_years = sorted([int(y) for y in df['Year'].unique()])
    if len(unique_years) >= 3:
        test_years = unique_years[-2:]
        train_years = unique_years[:-2]
        log_info(f"Using last 2 years for testing: {test_years}")
    else:
        test_years = []
        train_years = unique_years
        log_warning("Not enough years for separate test set")
    available_vars = [c for c in df.columns if c not in ['Year', 'Electricity']]
    valid_independent_vars = [v for v in independent_vars if v in available_vars]
    if not valid_independent_vars:
        log_info("Using Year only for MLR")
        valid_independent_vars = ['Year']
    columns_to_use = ['Year', 'Electricity'] + [v for v in valid_independent_vars if v != 'Year']
    df_filtered = df[columns_to_use].copy()
    
    for col in df_filtered.columns:
        if col != 'Year':
            df_filtered[col] = pd.to_numeric(df_filtered[col], errors='coerce')
            df_filtered[col] = df_filtered[col].fillna(df_filtered[col].mean() or 0)
    df_train = df_filtered[df_filtered['Year'].isin(train_years)].copy()
    df_test = df_filtered[df_filtered['Year'].isin(test_years)].copy() if test_years else pd.DataFrame()
    mlr_vars = [v for v in valid_independent_vars if v != 'Year'] or ['Year']
    X_train = df_train[mlr_vars]
    y_train = df_train['Electricity']
    X_test = df_test[mlr_vars] if not df_test.empty else pd.DataFrame()
    y_test = df_test['Electricity'] if not df_test.empty else pd.Series()
    X_train_slr = df_train['Year'].values.reshape(-1, 1)
    X_test_slr = df_test['Year'].values.reshape(-1, 1) if not df_test.empty else np.array([]).reshape(0, 1)
    X = df_filtered[mlr_vars]
    y = df_filtered['Electricity']
    X_slr = df_filtered['Year'].values.reshape(-1, 1)
    log_info(f"Training rows: {len(df_train)}, Test rows: {len(df_test)}, MLR vars: {mlr_vars}")
    return X_train, X_test, y_train, y_test, X_train_slr, X_test_slr, df_test, X, y, X_slr, mlr_vars

def train_models(
    X_train: pd.DataFrame,
    X_train_slr: np.ndarray,
    y_train: pd.Series,
    X_full: pd.DataFrame,
    X_full_slr: np.ndarray,
    y_full: pd.Series,
    models_to_train: List[str]
) -> Dict[str, Any]:
    models = {}

    param_grids = {
        'MLR': {'fit_intercept': [True, False], 'positive': [False]},
        'SLR': {'fit_intercept': [True, False]}
    }

    n_splits = min(DEFAULT_CV_SPLITS, len(X_train) - 1) if len(X_train) > 1 else 1
    tscv = TimeSeriesSplit(n_splits=n_splits) if n_splits >= 2 else None

    for model_name in models_to_train:
        try:
            if model_name == 'MLR':
                if len(X_train) < 2: raise ValueError("Insufficient training data for MLR")
                if tscv:
                    grid = GridSearchCV(LinearRegression(), param_grids['MLR'], cv=tscv, scoring='r2')
                    grid.fit(X_train, y_train)
                    best_model = grid.best_estimator_
                    log_info(f"MLR best params: {grid.best_params_}, best score: {grid.best_score_:.3f}")
                else:
                    best_model = LinearRegression().fit(X_train, y_train)
                    log_warning("MLR trained without cross-validation")
                best_model.fit(X_full, y_full)
                models['MLR'] = best_model

            elif model_name == 'SLR':
                if len(X_train_slr) < 2: raise ValueError("Insufficient training data for SLR")
                if tscv:
                    grid = GridSearchCV(LinearRegression(), param_grids['SLR'], cv=tscv, scoring='r2')
                    grid.fit(X_train_slr, y_train)
                    best = grid.best_params_
                    models['SLR'] = LinearRegression(**best).fit(X_full_slr, y_full)
                    log_info(f"SLR best params: {best}, CV score: {grid.best_score_:.3f}")
                else:
                    models['SLR'] = LinearRegression().fit(X_full_slr, y_full)
                    log_warning("SLR trained without cross-validation")

        except Exception as e:
            log_error(f"Model training failed for {model_name}: {e}")

    return models

def evaluate_model(y_true, y_pred, model_name=""):
    if len(y_true) == 0 or len(y_pred) == 0:
        return {'MSE': np.nan, 'R²': np.nan, 'MAPE (%)': np.nan}
    mse = mean_squared_error(y_true, y_pred)
    r2 = r2_score(y_true, y_pred)
    mape = np.nan if (y_true == 0).any() else mean_absolute_percentage_error(y_true, y_pred) * 100
    log_info(f"{model_name} – MSE={mse:.2f}, R²={r2:.3f}, MAPE={mape:.2f}%")
    return {'MSE': mse, 'R²': r2, 'MAPE (%)': mape}


def time_series_forecast(df, col, target_year):
    try:
        df = df[['Year', col]].dropna()
        if len(df) < 2:
            log_warning(f"Insufficient data for {col}")
            return np.zeros(max(0, int(target_year) - int(df['Year'].max())))
        if target_year <= df['Year'].max():
            return np.array([])
        X = df['Year'].values.reshape(-1, 1)
        y = df[col].values
        model = LinearRegression().fit(X, y)
        future = np.arange(int(df['Year'].max()) + 1, int(target_year) + 1).reshape(-1, 1)
        preds = model.predict(future)
        return np.maximum(preds, 0)
    except Exception as e:
        log_error(f"Time-series forecast error for {col}: {e}")
        return np.zeros(max(0, int(target_year) - 2023))


def save_results(sector_name, main_df, result_df_final, models, forecast_path):
    output_dir = Path(forecast_path)
    output_dir.mkdir(parents=True, exist_ok=True)
    file_path = output_dir / f"{sector_name}.xlsx"
    stats = {
        'Min': main_df['Electricity'].min(),
        'Max': main_df['Electricity'].max(),
        'Mean': main_df['Electricity'].mean(),
        'Std': main_df['Electricity'].std(),
        'Count': len(main_df)
    }
    with pd.ExcelWriter(file_path, engine='xlsxwriter') as writer:
        main_df.to_excel(writer, sheet_name='Inputs', index=False)
        result_df_final.to_excel(writer, sheet_name='Results', index=False)
        if models:
            pd.DataFrame([{'Model': k, 'Type': type(v).__name__, 'Parameters': str(v.get_params())}
                          for k, v in models.items()]).to_excel(writer, sheet_name='Models', index=False)
        pd.DataFrame([stats]).to_excel(writer, sheet_name='Statistics', index=False)
    log_info(f"Results saved to {file_path}")
    return str(file_path)


def process_sector(sector_name, sector_config, step_offset, total_steps, progress_reporter=None):
    try:
        log_info(f"Processing sector: {sector_name}")
        if progress_reporter:
            progress_reporter.update_sector_progress(10, "Preparing sector data", "Data Preparation")
        main_df = prepare_sector_data(sector_name, sector_config)

        models_to_use = sector_config.get('models', CONFIG.get('global_models', ['SLR']))
        parameters = sector_config.get('parameters', {})
        target_year = CONFIG.get('target_year', 2037)
        exclude_covid = CONFIG.get('exclude_covid', True)

        training_df = main_df.copy()
        if exclude_covid:
            covid_years = CONFIG.get('covid_years', [2020, 2021, 2022])
            training_df = training_df[~training_df['Year'].isin(covid_years)].copy()
        last_historical_year = training_df['Year'].max()
        user_future_data = main_df[main_df['Year'] > last_historical_year]
        has_user_future = not user_future_data.empty

        independent_vars = parameters.get('MLR', {}).get('independent_vars', [])
        X_train, X_test, y_train, y_test, X_train_slr, X_test_slr, df_test, X, y, X_slr, mlr_vars = \
            prepare_ml_data(training_df, independent_vars, target_year, exclude_covid)

        if progress_reporter:
            progress_reporter.update_sector_progress(40, "Training ML models", "Model Training")
        models = train_models(X_train, X_train_slr, y_train, X, X_slr, y,
                              [m for m in models_to_use if m in {'MLR', 'SLR'}])

        future_years = list(range(int(last_historical_year) + 1, target_year + 1))
        if not future_years:
            log_info("No future years to forecast")
            result_df = main_df[['Year', 'Electricity']].rename(columns={'Electricity': 'User Data'})
        else:
            X_future = pd.DataFrame({'Year': future_years})
            for col in main_df.columns:
                if col not in {'Year', 'Electricity'} and col in independent_vars:
                    col_df = main_df[['Year', col]].dropna()
                    if col_df['Year'].max() < target_year:
                        preds = time_series_forecast(main_df, col, target_year)
                        for i, yr in enumerate(future_years):
                            if i < len(preds):
                                X_future.loc[X_future['Year'] == yr, col] = preds[i]
            result_future = pd.DataFrame({'Year': X_future['Year']})
            if has_user_future:
                user_map = dict(zip(user_future_data['Year'], user_future_data['Electricity']))
                result_future['User Data'] = result_future['Year'].map(user_map).fillna(0)
            else:
                result_future['User Data'] = 0

            if 'MLR' in models and 'MLR' in models_to_use:
                X_pred = X_future[mlr_vars] if all(v in X_future.columns for v in mlr_vars) else X_future[['Year']]
                result_future['MLR'] = np.maximum(models['MLR'].predict(X_pred.fillna(0)), 0)
            if 'SLR' in models and 'SLR' in models_to_use:
                result_future['SLR'] = np.maximum(models['SLR'].predict(X_future['Year'].values.reshape(-1, 1)), 0)
            if 'WAM' in models_to_use:
                w = parameters.get('WAM', {}).get('window_size', 10)
                wam = weighted_average_forecast(main_df[main_df['Year'] <= last_historical_year][['Year', 'Electricity']],
                                                target_year, w, exclude_covid)
                wam_future = wam[wam['Year'] > last_historical_year]
                result_future['WAM'] = result_future['Year'].map(dict(zip(wam_future['Year'], wam_future['Electricity']))).fillna(0)
            if 'TimeSeries' in models_to_use:
                ts = time_series_forecast(main_df[main_df['Year'] <= last_historical_year], 'Electricity', target_year)
                result_future['TimeSeries'] = np.maximum(ts[:len(future_years)], 0)
            if len(result_future.columns) > 2:
                result_future = result_future.drop('User Data', axis=1)
            historical = main_df[main_df['Year'] <= last_historical_year]
            hist_df = pd.DataFrame({'Year': historical['Year']})
            for c in result_future.columns:
                if c != 'Year':
                    hist_df[c] = historical['Electricity']
            result_df = pd.concat([hist_df, result_future], ignore_index=True)

        if progress_reporter:
            progress_reporter.update_sector_progress(80, "Evaluating models", "Model Evaluation")
        evaluation = []
        if not df_test.empty and len(y_test) > 0:
            if 'MLR' in models:
                evaluation.append({'Model': 'MLR', **evaluate_model(y_test, models['MLR'].predict(X_test), "MLR")})
            if 'SLR' in models:
                evaluation.append({'Model': 'SLR', **evaluate_model(y_test, models['SLR'].predict(X_test_slr), "SLR")})

        if progress_reporter:
            progress_reporter.update_sector_progress(90, "Saving results", "Results Export")
        output_file = save_results(sector_name, main_df, result_df,
                                   models if not has_user_future else {},
                                   CONFIG.get('forecast_path', CONFIG['scenario_name']))
        
        if progress_reporter:
            progress_reporter.update_sector_progress(100, "Sector completed", "Completed")
        return dict(sector=sector_name, status="completed",
                    models_used=['User Data'] if has_user_future else models_to_use,
                    forecast_years=len(future_years) if not has_user_future else 0,
                    output_file=output_file, evaluation=evaluation, data_points=len(main_df))
    except Exception as e:
        log_error(f"Error processing sector {sector_name}: {e}")
        emit_progress({"type": "sector_failed", "sector": sector_name, "error": str(e),
                       "timestamp": datetime.now().isoformat()})
        raise

def main():
    global CONFIG, TOTAL_STEPS, CURRENT_STEP
    parser = argparse.ArgumentParser(description="KSEB Demand Forecasting Script")
    parser.add_argument('--config', required=True, help="Path to JSON configuration file")
    args = parser.parse_args()
    CONFIG = load_config(args.config)

    log_info("=" * 60)
    log_info("KSEB DEMAND FORECASTING SYSTEM")
    log_info("=" * 60)
    log_info(f"Scenario: {CONFIG['scenario_name']}")
    log_info(f"Target year: {CONFIG['target_year']}")
    log_info(f"Exclude COVID: {CONFIG.get('exclude_covid', True)}")

    enabled_sectors = {n: c for n, c in CONFIG['sectors'].items() if c.get('enabled', True)}
    if not enabled_sectors:
        raise ValueError("No enabled sectors")
    log_info(f"Processing {len(enabled_sectors)} sectors: {list(enabled_sectors.keys())}")

    steps_per_sector = 7
    TOTAL_STEPS = len(enabled_sectors) * steps_per_sector
    report_progress(0, TOTAL_STEPS, "Initializing forecast", "Overall")
    progress_reporter = ProgressReporter(len(enabled_sectors))
    results, CURRENT_STEP = [], 0

    for i, (sector_name, cfg) in enumerate(enabled_sectors.items()):
        try:
            log_info(f"\n--- Sector {i+1}/{len(enabled_sectors)}: {sector_name} ---")
            progress_reporter.start_sector(sector_name)
            result = process_sector(sector_name, cfg, CURRENT_STEP, TOTAL_STEPS, progress_reporter)
            results.append(result)
            CURRENT_STEP += steps_per_sector
            progress_reporter.complete_sector()
        except Exception as e:
            results.append({"sector": sector_name, "status": "failed", "error": str(e)})
            CURRENT_STEP += steps_per_sector

    successful = [r for r in results if r['status'] == 'completed']
    failed = [r for r in results if r['status'] == 'failed']
    log_info("=" * 60)
    log_info("FORECAST SUMMARY")
    log_info("=" * 60)
    log_info(f"Total sectors: {len(enabled_sectors)} | Successful: {len(successful)} | Failed: {len(failed)}")
    
    # --- ⭐ ADDED: Save scenario metadata on successful completion ---
    if not failed:
        try:
            meta_path = Path(CONFIG.get('forecast_path', CONFIG['scenario_name'])) / 'scenario_meta.json'
            meta_data = {'targetYear': CONFIG['target_year']}
            with open(meta_path, 'w', encoding='utf-8') as f:
                json.dump(meta_data, f, indent=2)
            log_info(f"Scenario metadata saved to {meta_path}")
        except Exception as e:
            log_error(f"Failed to save scenario metadata: {e}")
    # --- END ADDED SECTION ---

    final = dict(status="completed",
                 scenario_name=CONFIG['scenario_name'],
                 target_year=CONFIG['target_year'],
                 total_sectors=len(enabled_sectors),
                 successful_sectors=len(successful),
                 failed_sectors=len(failed),
                 results=results,
                 output_directory=CONFIG.get('forecast_path', CONFIG['scenario_name']),
                 timestamp=datetime.now().isoformat())
    print(json.dumps(final, indent=2))
    sys.stdout.flush()
    sys.exit(0 if len(failed) == 0 else 1)


if __name__ == "__main__":
    try:
        main()
    finally:
        sys.stdout.flush()