"""
Comprehensive PyPSA Network Analyzer
====================================

Enhanced analyzer with support for all PyPSA components:
- Bus, Carrier, Generator, Load, Link, Store, Storage Unit
- Line, Line Types, Transformer, Transformer Types
- Shunt Impedance, Global Constraints, Shapes, Sub-Network
"""

import pypsa
import pandas as pd
import numpy as np
import logging
from typing import Dict, List, Optional, Tuple, Any, Union
from pathlib import Path
from dataclasses import dataclass
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ============================================================================
# COMPREHENSIVE COMPONENT ANALYZER
# ============================================================================

class ComponentAnalyzer:
    """Analyze all PyPSA network components in detail."""
    
    def __init__(self, network: pypsa.Network):
        self.network = network
        self.n = network  # Short alias
        
    # ========================================================================
    # BUS ANALYSIS
    # ========================================================================
    
    def analyze_buses(self) -> Dict[str, Any]:
        """
        Comprehensive bus analysis.
        
        Returns
        -------
        dict
            Bus analysis including:
            - Total count and types
            - Voltage levels
            - Connected components per bus
            - Zonal/country grouping
            - Nodal prices (if solved)
        """
        if not hasattr(self.n, 'buses') or self.n.buses.empty:
            return {'status': 'no_buses', 'count': 0}
        
        buses = self.n.buses
        analysis = {
            'count': len(buses),
            'carriers': buses['carrier'].unique().tolist() if 'carrier' in buses.columns else [],
            'has_coordinates': 'x' in buses.columns and 'y' in buses.columns,
        }
        
        # Voltage levels
        if 'v_nom' in buses.columns:
            analysis['voltage_levels'] = {
                'unique': sorted(buses['v_nom'].unique().tolist()),
                'min': buses['v_nom'].min(),
                'max': buses['v_nom'].max(),
                'distribution': buses['v_nom'].value_counts().to_dict()
            }
        
        # Zonal information
        if 'country' in buses.columns:
            analysis['countries'] = buses['country'].value_counts().to_dict()
        if 'zone' in buses.columns:
            analysis['zones'] = buses['zone'].value_counts().to_dict()
        
        # Connected components count
        analysis['connected_components'] = {}
        for comp_type in ['generators', 'loads', 'storage_units', 'stores', 'lines', 'links']:
            if hasattr(self.n, comp_type):
                comp_df = getattr(self.n, comp_type)
                if not comp_df.empty and 'bus' in comp_df.columns:
                    analysis['connected_components'][comp_type] = comp_df.groupby('bus').size().to_dict()
        
        # Nodal prices (if network is solved)
        if hasattr(self.n, 'buses_t') and hasattr(self.n.buses_t, 'marginal_price'):
            prices = self.n.buses_t.marginal_price
            if not prices.empty:
                analysis['prices'] = {
                    'mean': prices.mean().to_dict(),
                    'std': prices.std().to_dict(),
                    'min': prices.min().to_dict(),
                    'max': prices.max().to_dict()
                }
        
        # Bus utilization/loading
        if hasattr(self.n, 'buses_t') and hasattr(self.n.buses_t, 'p'):
            bus_power = self.n.buses_t.p
            if not bus_power.empty:
                analysis['power_flow'] = {
                    'peak_injection': bus_power.max().to_dict(),
                    'peak_withdrawal': bus_power.min().to_dict(),
                    'avg_flow': bus_power.mean().to_dict()
                }
        
        return analysis
    
    # ========================================================================
    # CARRIER ANALYSIS
    # ========================================================================
    
    def analyze_carriers(self) -> Dict[str, Any]:
        """
        Comprehensive carrier analysis.
        
        Returns
        -------
        dict
            Carrier properties including:
            - CO2 emissions
            - Colors for visualization
            - Usage across components
        """
        if not hasattr(self.n, 'carriers') or self.n.carriers.empty:
            return {'status': 'no_carriers', 'count': 0}
        
        carriers = self.n.carriers
        analysis = {
            'count': len(carriers),
            'list': carriers.index.tolist(),
            'properties': {}
        }
        
        # Emission data
        if 'co2_emissions' in carriers.columns:
            analysis['emissions'] = carriers['co2_emissions'].to_dict()
            analysis['emissions_stats'] = {
                'total_unique': carriers['co2_emissions'].nunique(),
                'zero_emission': (carriers['co2_emissions'] == 0).sum(),
                'max_emission_rate': carriers['co2_emissions'].max(),
                'carriers_with_emissions': carriers[carriers['co2_emissions'] > 0].index.tolist()
            }
        
        # Colors
        if 'color' in carriers.columns:
            analysis['colors'] = carriers['color'].to_dict()
        
        # Usage across components
        analysis['usage'] = {}
        for comp_type in ['generators', 'storage_units', 'stores', 'links', 'loads']:
            if hasattr(self.n, comp_type):
                comp_df = getattr(self.n, comp_type)
                if not comp_df.empty and 'carrier' in comp_df.columns:
                    analysis['usage'][comp_type] = comp_df['carrier'].value_counts().to_dict()
        
        # Additional properties
        for col in carriers.columns:
            if col not in ['co2_emissions', 'color'] and carriers[col].dtype in ['float64', 'int64']:
                analysis['properties'][col] = carriers[col].to_dict()
        
        return analysis
    
    # ========================================================================
    # GENERATOR ANALYSIS
    # ========================================================================
    
    def analyze_generators(self, include_time_series: bool = True) -> Dict[str, Any]:
        """
        Comprehensive generator analysis.
        
        Parameters
        ----------
        include_time_series : bool
            Whether to include time series statistics
            
        Returns
        -------
        dict
            Generator analysis including capacity, generation, economics
        """
        if not hasattr(self.n, 'generators') or self.n.generators.empty:
            return {'status': 'no_generators', 'count': 0}
        
        gens = self.n.generators
        analysis = {
            'count': len(gens),
            'by_carrier': gens['carrier'].value_counts().to_dict() if 'carrier' in gens.columns else {},
            'by_bus': gens['bus'].value_counts().to_dict() if 'bus' in gens.columns else {},
        }
        
        # Capacity analysis
        if 'p_nom' in gens.columns:
            analysis['installed_capacity'] = {
                'total_mw': gens['p_nom'].sum(),
                'by_carrier': gens.groupby('carrier')['p_nom'].sum().to_dict() if 'carrier' in gens.columns else {},
                'max_unit': gens['p_nom'].max(),
                'min_unit': gens['p_nom'].min()
            }
        
        if 'p_nom_opt' in gens.columns:
            analysis['optimal_capacity'] = {
                'total_mw': gens['p_nom_opt'].sum(),
                'by_carrier': gens.groupby('carrier')['p_nom_opt'].sum().to_dict() if 'carrier' in gens.columns else {},
                'expandable_count': (gens['p_nom_opt'] > gens['p_nom']).sum()
            }
        
        # Efficiency
        if 'efficiency' in gens.columns:
            analysis['efficiency'] = {
                'mean': gens['efficiency'].mean(),
                'by_carrier': gens.groupby('carrier')['efficiency'].mean().to_dict() if 'carrier' in gens.columns else {}
            }
        
        # Economics
        if 'marginal_cost' in gens.columns:
            analysis['marginal_costs'] = {
                'mean': gens['marginal_cost'].mean(),
                'median': gens['marginal_cost'].median(),
                'by_carrier': gens.groupby('carrier')['marginal_cost'].mean().to_dict() if 'carrier' in gens.columns else {}
            }
        
        if 'capital_cost' in gens.columns:
            analysis['capital_costs'] = {
                'total': (gens['capital_cost'] * gens.get('p_nom_opt', gens.get('p_nom', 0))).sum(),
                'by_carrier': gens.groupby('carrier').apply(
                    lambda x: (x['capital_cost'] * x.get('p_nom_opt', x.get('p_nom', 0))).sum()
                ).to_dict() if 'carrier' in gens.columns else {}
            }
        
        # Time series analysis
        if include_time_series and hasattr(self.n, 'generators_t'):
            ts_analysis = {}
            
            # Generation
            if hasattr(self.n.generators_t, 'p') and not self.n.generators_t.p.empty:
                gen_p = self.n.generators_t.p
                ts_analysis['generation'] = {
                    'total_mwh': gen_p.sum().sum(),
                    'by_carrier': self._aggregate_by_carrier(gen_p, gens).sum().to_dict(),
                    'peak_mw': gen_p.sum(axis=1).max(),
                    'capacity_factors': self._calculate_capacity_factors(gen_p, gens)
                }
            
            # Availability
            if hasattr(self.n.generators_t, 'p_max_pu'):
                ts_analysis['availability'] = {
                    'mean': self.n.generators_t.p_max_pu.mean().to_dict(),
                    'min': self.n.generators_t.p_max_pu.min().to_dict()
                }
            
            analysis['time_series'] = ts_analysis
        
        # Ramp rates and technical constraints
        if 'ramp_limit_up' in gens.columns:
            analysis['ramp_limit_up'] = gens['ramp_limit_up'].mean()
        if 'ramp_limit_down' in gens.columns:
            analysis['ramp_limit_down'] = gens['ramp_limit_down'].mean()
        
        # Committable units
        if 'committable' in gens.columns:
            analysis['committable'] = {
                'count': gens['committable'].sum(),
                'by_carrier': gens[gens['committable']].groupby('carrier').size().to_dict() if 'carrier' in gens.columns else {}
            }
        
        return analysis
    
    # ========================================================================
    # LOAD ANALYSIS
    # ========================================================================
    
    def analyze_loads(self, include_time_series: bool = True) -> Dict[str, Any]:
        """Comprehensive load analysis."""
        if not hasattr(self.n, 'loads') or self.n.loads.empty:
            return {'status': 'no_loads', 'count': 0}
        
        loads = self.n.loads
        analysis = {
            'count': len(loads),
            'by_bus': loads['bus'].value_counts().to_dict() if 'bus' in loads.columns else {},
        }
        
        # Static load values
        if 'p_set' in loads.columns:
            analysis['static_load'] = {
                'total_mw': loads['p_set'].sum(),
                'by_bus': loads.groupby('bus')['p_set'].sum().to_dict() if 'bus' in loads.columns else {}
            }
        
        # Time series analysis
        if include_time_series and hasattr(self.n, 'loads_t'):
            for attr in ['p', 'p_set']:
                if hasattr(self.n.loads_t, attr):
                    load_data = getattr(self.n.loads_t, attr)
                    if not load_data.empty:
                        analysis['time_series'] = {
                            'total_demand_mwh': load_data.sum().sum(),
                            'peak_demand_mw': load_data.sum(axis=1).max(),
                            'min_demand_mw': load_data.sum(axis=1).min(),
                            'avg_demand_mw': load_data.sum(axis=1).mean(),
                            'load_factor': load_data.sum(axis=1).mean() / load_data.sum(axis=1).max(),
                            'by_bus': {
                                'peak': load_data.max().to_dict(),
                                'total': load_data.sum().to_dict()
                            }
                        }
                        break
        
        return analysis
    
    # ========================================================================
    # STORAGE UNIT ANALYSIS (PHS, CAES, etc. - MW-based)
    # ========================================================================
    
    def analyze_storage_units(self, include_time_series: bool = True) -> Dict[str, Any]:
        """
        Comprehensive storage unit analysis.
        
        Storage Units are power-based (MW) with energy capacity derived from max_hours.
        Examples: Pumped Hydro Storage (PHS), Compressed Air Energy Storage (CAES)
        """
        if not hasattr(self.n, 'storage_units') or self.n.storage_units.empty:
            return {'status': 'no_storage_units', 'count': 0}
        
        su = self.n.storage_units
        analysis = {
            'count': len(su),
            'by_carrier': su['carrier'].value_counts().to_dict() if 'carrier' in su.columns else {},
            'type': 'power_based_mw'
        }
        
        # Power capacity
        if 'p_nom' in su.columns:
            analysis['power_capacity'] = {
                'total_mw': su['p_nom'].sum(),
                'by_carrier': su.groupby('carrier')['p_nom'].sum().to_dict() if 'carrier' in su.columns else {}
            }
        
        if 'p_nom_opt' in su.columns:
            analysis['optimal_power_capacity'] = {
                'total_mw': su['p_nom_opt'].sum(),
                'by_carrier': su.groupby('carrier')['p_nom_opt'].sum().to_dict() if 'carrier' in su.columns else {}
            }
        
        # Energy capacity (from max_hours)
        if 'max_hours' in su.columns:
            p_nom_col = 'p_nom_opt' if 'p_nom_opt' in su.columns else 'p_nom'
            energy_capacity = su[p_nom_col] * su['max_hours']
            analysis['energy_capacity'] = {
                'total_mwh': energy_capacity.sum(),
                'by_carrier': su.groupby('carrier').apply(
                    lambda x: (x[p_nom_col] * x['max_hours']).sum()
                ).to_dict() if 'carrier' in su.columns else {},
                'avg_max_hours': su['max_hours'].mean()
            }
        
        # Efficiency
        if 'efficiency_store' in su.columns and 'efficiency_dispatch' in su.columns:
            analysis['efficiency'] = {
                'round_trip': (su['efficiency_store'] * su['efficiency_dispatch']).mean(),
                'store': su['efficiency_store'].mean(),
                'dispatch': su['efficiency_dispatch'].mean()
            }
        
        # Technical parameters
        if 'standing_loss' in su.columns:
            analysis['standing_loss'] = su['standing_loss'].mean()
        
        if 'cyclic_state_of_charge' in su.columns:
            analysis['cyclic_soc'] = su['cyclic_state_of_charge'].sum()
        
        # Time series operation
        if include_time_series and hasattr(self.n, 'storage_units_t'):
            ts_analysis = {}
            
            if hasattr(self.n.storage_units_t, 'p') and not self.n.storage_units_t.p.empty:
                su_p = self.n.storage_units_t.p
                
                # Separate charge and discharge
                discharge = su_p.clip(lower=0)
                charge = -su_p.clip(upper=0)
                
                ts_analysis['operation'] = {
                    'total_discharge_mwh': discharge.sum().sum(),
                    'total_charge_mwh': charge.sum().sum(),
                    'round_trip_efficiency': discharge.sum().sum() / charge.sum().sum() if charge.sum().sum() > 0 else 0,
                    'by_carrier': {}
                }
                
                if 'carrier' in su.columns:
                    for carrier in su['carrier'].unique():
                        carrier_su = su[su['carrier'] == carrier].index
                        ts_analysis['operation']['by_carrier'][carrier] = {
                            'discharge_mwh': discharge[carrier_su].sum().sum(),
                            'charge_mwh': charge[carrier_su].sum().sum()
                        }
            
            # State of charge
            if hasattr(self.n.storage_units_t, 'state_of_charge'):
                soc = self.n.storage_units_t.state_of_charge
                if not soc.empty:
                    ts_analysis['state_of_charge'] = {
                        'mean_mwh': soc.mean().sum(),
                        'max_mwh': soc.max().sum(),
                        'min_mwh': soc.min().sum()
                    }
            
            analysis['time_series'] = ts_analysis
        
        return analysis
    
    # ========================================================================
    # STORE ANALYSIS (Batteries, H2, etc. - MWh-based)
    # ========================================================================
    
    def analyze_stores(self, include_time_series: bool = True) -> Dict[str, Any]:
        """
        Comprehensive store analysis.
        
        Stores are energy-based (MWh) storage.
        Examples: Batteries, Hydrogen storage, Heat storage
        """
        if not hasattr(self.n, 'stores') or self.n.stores.empty:
            return {'status': 'no_stores', 'count': 0}
        
        stores = self.n.stores
        analysis = {
            'count': len(stores),
            'by_carrier': stores['carrier'].value_counts().to_dict() if 'carrier' in stores.columns else {},
            'type': 'energy_based_mwh'
        }
        
        # Energy capacity
        if 'e_nom' in stores.columns:
            analysis['energy_capacity'] = {
                'total_mwh': stores['e_nom'].sum(),
                'by_carrier': stores.groupby('carrier')['e_nom'].sum().to_dict() if 'carrier' in stores.columns else {}
            }
        
        if 'e_nom_opt' in stores.columns:
            analysis['optimal_energy_capacity'] = {
                'total_mwh': stores['e_nom_opt'].sum(),
                'by_carrier': stores.groupby('carrier')['e_nom_opt'].sum().to_dict() if 'carrier' in stores.columns else {},
                'expandable_count': (stores['e_nom_opt'] > stores['e_nom']).sum()
            }
        
        # Initial and cyclic state
        if 'e_initial' in stores.columns:
            analysis['initial_energy'] = stores['e_initial'].sum()
        
        if 'e_cyclic' in stores.columns:
            analysis['cyclic_stores'] = stores['e_cyclic'].sum()
        
        # Economics
        if 'marginal_cost' in stores.columns:
            analysis['marginal_cost'] = stores['marginal_cost'].mean()
        
        if 'capital_cost' in stores.columns:
            e_nom_col = 'e_nom_opt' if 'e_nom_opt' in stores.columns else 'e_nom'
            analysis['capital_costs'] = {
                'total': (stores['capital_cost'] * stores[e_nom_col]).sum(),
                'by_carrier': stores.groupby('carrier').apply(
                    lambda x: (x['capital_cost'] * x[e_nom_col]).sum()
                ).to_dict() if 'carrier' in stores.columns else {}
            }
        
        # Standing loss
        if 'standing_loss' in stores.columns:
            analysis['standing_loss'] = stores['standing_loss'].mean()
        
        # Time series operation
        if include_time_series and hasattr(self.n, 'stores_t'):
            ts_analysis = {}
            
            # Power flow
            if hasattr(self.n.stores_t, 'p') and not self.n.stores_t.p.empty:
                store_p = self.n.stores_t.p
                
                discharge = store_p.clip(lower=0)
                charge = -store_p.clip(upper=0)
                
                ts_analysis['operation'] = {
                    'total_discharge_mwh': discharge.sum().sum(),
                    'total_charge_mwh': charge.sum().sum(),
                    'by_carrier': {}
                }
                
                if 'carrier' in stores.columns:
                    for carrier in stores['carrier'].unique():
                        carrier_stores = stores[stores['carrier'] == carrier].index
                        ts_analysis['operation']['by_carrier'][carrier] = {
                            'discharge_mwh': discharge[carrier_stores].sum().sum(),
                            'charge_mwh': charge[carrier_stores].sum().sum()
                        }
            
            # Energy state
            if hasattr(self.n.stores_t, 'e') and not self.n.stores_t.e.empty:
                store_e = self.n.stores_t.e
                ts_analysis['energy_state'] = {
                    'mean_mwh': store_e.mean().sum(),
                    'max_mwh': store_e.max().sum(),
                    'min_mwh': store_e.min().sum(),
                    'by_carrier': {}
                }
                
                if 'carrier' in stores.columns:
                    for carrier in stores['carrier'].unique():
                        carrier_stores = stores[stores['carrier'] == carrier].index
                        ts_analysis['energy_state']['by_carrier'][carrier] = {
                            'mean_mwh': store_e[carrier_stores].mean().sum(),
                            'max_mwh': store_e[carrier_stores].max().sum()
                        }
            
            analysis['time_series'] = ts_analysis
        
        return analysis
    
    # ========================================================================
    # LINK ANALYSIS
    # ========================================================================
    
    def analyze_links(self, include_time_series: bool = True) -> Dict[str, Any]:
        """
        Comprehensive link analysis.
        
        Links can represent DC lines, sector coupling, or any directed power flow.
        """
        if not hasattr(self.n, 'links') or self.n.links.empty:
            return {'status': 'no_links', 'count': 0}
        
        links = self.n.links
        analysis = {
            'count': len(links),
            'by_carrier': links['carrier'].value_counts().to_dict() if 'carrier' in links.columns else {},
        }
        
        # Capacity
        if 'p_nom' in links.columns:
            analysis['capacity'] = {
                'total_mw': links['p_nom'].sum(),
                'by_carrier': links.groupby('carrier')['p_nom'].sum().to_dict() if 'carrier' in links.columns else {}
            }
        
        if 'p_nom_opt' in links.columns:
            analysis['optimal_capacity'] = {
                'total_mw': links['p_nom_opt'].sum(),
                'by_carrier': links.groupby('carrier')['p_nom_opt'].sum().to_dict() if 'carrier' in links.columns else {}
            }
        
        # Efficiency
        if 'efficiency' in links.columns:
            analysis['efficiency'] = {
                'mean': links['efficiency'].mean(),
                'by_carrier': links.groupby('carrier')['efficiency'].mean().to_dict() if 'carrier' in links.columns else {}
            }
        
        # Multi-port links
        if 'bus2' in links.columns:
            multi_port = links[links['bus2'].notna()]
            analysis['multi_port'] = {
                'count': len(multi_port),
                'efficiency2': multi_port['efficiency2'].mean() if 'efficiency2' in multi_port.columns else None
            }
        
        # Length (for transmission links)
        if 'length' in links.columns:
            analysis['length'] = {
                'total_km': links['length'].sum(),
                'mean_km': links['length'].mean(),
                'max_km': links['length'].max()
            }
        
        # Time series operation
        if include_time_series and hasattr(self.n, 'links_t'):
            ts_analysis = {}
            
            if hasattr(self.n.links_t, 'p0') and not self.n.links_t.p0.empty:
                link_p = self.n.links_t.p0
                
                ts_analysis['flow'] = {
                    'total_mwh': link_p.abs().sum().sum(),
                    'peak_mw': link_p.abs().max().max(),
                    'avg_mw': link_p.abs().mean().mean(),
                    'by_carrier': {}
                }
                
                if 'carrier' in links.columns:
                    for carrier in links['carrier'].unique():
                        carrier_links = links[links['carrier'] == carrier].index
                        ts_analysis['flow']['by_carrier'][carrier] = {
                            'total_mwh': link_p[carrier_links].abs().sum().sum(),
                            'peak_mw': link_p[carrier_links].abs().max().max()
                        }
            
            analysis['time_series'] = ts_analysis
        
        return analysis
    
    # ========================================================================
    # LINE ANALYSIS
    # ========================================================================
    
    def analyze_lines(self, include_time_series: bool = True) -> Dict[str, Any]:
        """Comprehensive AC line analysis."""
        if not hasattr(self.n, 'lines') or self.n.lines.empty:
            return {'status': 'no_lines', 'count': 0}
        
        lines = self.n.lines
        analysis = {
            'count': len(lines),
        }
        
        # Capacity
        if 's_nom' in lines.columns:
            analysis['capacity'] = {
                'total_mva': lines['s_nom'].sum(),
                'mean_mva': lines['s_nom'].mean()
            }
        
        if 's_nom_opt' in lines.columns:
            analysis['optimal_capacity'] = {
                'total_mva': lines['s_nom_opt'].sum(),
                'expandable': (lines['s_nom_opt'] > lines['s_nom']).sum()
            }
        
        # Length and electrical properties
        if 'length' in lines.columns:
            analysis['length'] = {
                'total_km': lines['length'].sum(),
                'mean_km': lines['length'].mean(),
                'max_km': lines['length'].max()
            }
        
        if 'r' in lines.columns:
            analysis['resistance'] = {
                'mean_pu': lines['r'].mean(),
                'max_pu': lines['r'].max()
            }
        
        if 'x' in lines.columns:
            analysis['reactance'] = {
                'mean_pu': lines['x'].mean(),
                'max_pu': lines['x'].max()
            }
        
        # Line types
        if 'type' in lines.columns:
            analysis['types'] = lines['type'].value_counts().to_dict()
        
        # Time series flows
        if include_time_series and hasattr(self.n, 'lines_t'):
            ts_analysis = {}
            
            if hasattr(self.n.lines_t, 'p0') and not self.n.lines_t.p0.empty:
                line_p = self.n.lines_t.p0
                
                # Calculate utilization
                utilization = {}
                if 's_nom' in lines.columns:
                    for line in line_p.columns:
                        if line in lines.index:
                            s_nom = lines.loc[line, 's_nom_opt'] if 's_nom_opt' in lines.columns else lines.loc[line, 's_nom']
                            if s_nom > 0:
                                utilization[line] = (line_p[line].abs().mean() / s_nom * 100)
                
                ts_analysis['flow'] = {
                    'total_mwh': line_p.abs().sum().sum(),
                    'peak_mw': line_p.abs().max().max(),
                    'utilization_pct': utilization
                }
            
            analysis['time_series'] = ts_analysis
        
        return analysis
    
    # ========================================================================
    # TRANSFORMER ANALYSIS
    # ========================================================================
    
    def analyze_transformers(self) -> Dict[str, Any]:
        """Comprehensive transformer analysis."""
        if not hasattr(self.n, 'transformers') or self.n.transformers.empty:
            return {'status': 'no_transformers', 'count': 0}
        
        transformers = self.n.transformers
        analysis = {
            'count': len(transformers),
        }
        
        # Capacity
        if 's_nom' in transformers.columns:
            analysis['capacity'] = {
                'total_mva': transformers['s_nom'].sum(),
                'mean_mva': transformers['s_nom'].mean()
            }
        
        # Tap ratio
        if 'tap_ratio' in transformers.columns:
            analysis['tap_ratio'] = {
                'mean': transformers['tap_ratio'].mean(),
                'adjustable': (transformers['tap_ratio'] != 1.0).sum()
            }
        
        # Types
        if 'type' in transformers.columns:
            analysis['types'] = transformers['type'].value_counts().to_dict()
        
        return analysis
    
    # ========================================================================
    # GLOBAL CONSTRAINTS ANALYSIS
    # ========================================================================
    
    def analyze_global_constraints(self) -> Dict[str, Any]:
        """Analyze global constraints like CO2 limits."""
        if not hasattr(self.n, 'global_constraints') or self.n.global_constraints.empty:
            return {'status': 'no_global_constraints'}
        
        gc = self.n.global_constraints
        analysis = {
            'count': len(gc),
            'constraints': {}
        }
        
        for constraint in gc.index:
            constraint_data = {
                'type': gc.loc[constraint, 'type'] if 'type' in gc.columns else None,
                'sense': gc.loc[constraint, 'sense'] if 'sense' in gc.columns else None,
                'constant': gc.loc[constraint, 'constant'] if 'constant' in gc.columns else None,
            }
            
            # Shadow price (if solved)
            if 'mu' in gc.columns:
                constraint_data['shadow_price'] = gc.loc[constraint, 'mu']
            
            analysis['constraints'][constraint] = constraint_data
        
        return analysis
    
    # ========================================================================
    # HELPER METHODS
    # ========================================================================
    
    def _aggregate_by_carrier(self, df: pd.DataFrame, component_df: pd.DataFrame) -> pd.DataFrame:
        """Aggregate time series data by carrier."""
        if 'carrier' not in component_df.columns:
            return df
        
        result = pd.DataFrame()
        for carrier in component_df['carrier'].unique():
            comps = component_df[component_df['carrier'] == carrier].index
            cols = df.columns.intersection(comps)
            if len(cols) > 0:
                result[carrier] = df[cols].sum(axis=1)
        return result
    
    def _calculate_capacity_factors(self, generation: pd.DataFrame, 
                                   generators: pd.DataFrame) -> Dict[str, float]:
        """Calculate capacity factors by carrier."""
        if 'carrier' not in generators.columns:
            return {}
        
        cf_by_carrier = {}
        p_nom_col = 'p_nom_opt' if 'p_nom_opt' in generators.columns else 'p_nom'
        
        for carrier in generators['carrier'].unique():
            gens = generators[generators['carrier'] == carrier].index
            cols = generation.columns.intersection(gens)
            
            if len(cols) > 0:
                total_generation = generation[cols].sum().sum()
                total_capacity = generators.loc[cols, p_nom_col].sum()
                n_hours = len(generation)
                
                if total_capacity > 0:
                    cf_by_carrier[carrier] = total_generation / (total_capacity * n_hours)
        
        return cf_by_carrier
    
    # ========================================================================
    # COMPREHENSIVE NETWORK ANALYSIS
    # ========================================================================
    
    def analyze_all_components(self, include_time_series: bool = True) -> Dict[str, Any]:
        """
        Perform comprehensive analysis of all network components.
        
        Returns
        -------
        dict
            Complete analysis of all components
        """
        logger.info("Starting comprehensive component analysis...")
        
        analysis = {
            'timestamp': datetime.now().isoformat(),
            'network_name': getattr(self.n, 'name', 'unnamed'),
        }
        
        # Analyze each component type
        component_types = [
            ('buses', self.analyze_buses),
            ('carriers', self.analyze_carriers),
            ('generators', lambda: self.analyze_generators(include_time_series)),
            ('loads', lambda: self.analyze_loads(include_time_series)),
            ('storage_units', lambda: self.analyze_storage_units(include_time_series)),
            ('stores', lambda: self.analyze_stores(include_time_series)),
            ('links', lambda: self.analyze_links(include_time_series)),
            ('lines', lambda: self.analyze_lines(include_time_series)),
            ('transformers', self.analyze_transformers),
            ('global_constraints', self.analyze_global_constraints),
        ]
        
        for comp_name, analyzer_func in component_types:
            try:
                logger.info(f"Analyzing {comp_name}...")
                analysis[comp_name] = analyzer_func()
            except Exception as e:
                logger.error(f"Error analyzing {comp_name}: {e}")
                analysis[comp_name] = {'status': 'error', 'message': str(e)}
        
        logger.info("Component analysis complete")
        return analysis
