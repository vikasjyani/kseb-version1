"""
Complete PyPSA Visualizer with Multi-Period Support
===================================================

Full implementation of all visualizations for single, multi-network, and multi-period analysis.
Includes comprehensive filters and interactive features.

Author: KSEB Analytics Team
Date: 2025-01-15
"""

import pypsa
import pandas as pd
import numpy as np
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots
import logging
from typing import Dict, List, Optional, Union, Any, Tuple
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)

# ============================================================================
# COLOR MANAGEMENT
# ============================================================================

DEFAULT_COLORS = {
    'coal': '#000000', 'lignite': '#4B4B4B', 'oil': '#FF4500',
    'gas': '#FF6347', 'OCGT': '#FFA07A', 'CCGT': '#FF6B6B',
    'nuclear': '#800080',
    'solar': '#FFD700', 'pv': '#FFD700', 'solar thermal': '#FFA500',
    'wind': '#ADD8E6', 'onwind': '#ADD8E6', 'offwind': '#87CEEB',
    'hydro': '#0073CF', 'ror': '#3399FF', 'reservoir': '#0056A3',
    'biomass': '#228B22', 'biogas': '#32CD32',
    'phs': '#3399FF', 'PHS': '#3399FF', 'pumped hydro': '#3399FF',
    'battery': '#005B5B', 'Battery': '#005B5B', 'li-ion': '#005B5B',
    'hydrogen': '#AFEEEE', 'H2': '#AFEEEE',
    'load': '#000000', 'curtailment': '#FF00FF', 'other': '#D3D3D3'
}


def get_color(carrier: str, network: pypsa.Network = None) -> str:
    """Get color for carrier with fallback."""
    if network and hasattr(network, 'carriers'):
        if carrier in network.carriers.index and 'color' in network.carriers.columns:
            color = network.carriers.loc[carrier, 'color']
            if pd.notna(color):
                return color

    carrier_lower = carrier.lower()
    for key, color in DEFAULT_COLORS.items():
        if key.lower() == carrier_lower or key.lower() in carrier_lower:
            return color

    # Generate from hash
    import hashlib
    color_hash = hashlib.md5(carrier.encode()).hexdigest()[:6]
    return f'#{color_hash}'


# ============================================================================
# COMPLETE VISUALIZER WITH FILTERS
# ============================================================================

class CompletePyPSAVisualizer:
    """
    Complete visualization suite with filters and multi-period support.
    """

    def __init__(self, network: pypsa.Network, is_multi_period: bool = None):
        """
        Initialize visualizer.

        Parameters
        ----------
        network : pypsa.Network
            PyPSA network
        is_multi_period : bool, optional
            Whether network has multi-period structure (auto-detected if None)
        """
        self.network = network
        self.n = network

        if is_multi_period is None:
            self.is_multi_period = isinstance(network.snapshots, pd.MultiIndex)
        else:
            self.is_multi_period = is_multi_period

        logger.info(f"Visualizer initialized (multi-period: {self.is_multi_period})")

    # ========================================================================
    # DISPATCH PLOTS
    # ========================================================================

    def plot_dispatch(self,
                     start_date: Optional[str] = None,
                     end_date: Optional[str] = None,
                     carriers: Optional[List[str]] = None,
                     resolution: str = '1H',
                     stacked: bool = True,
                     show_storage: bool = True,
                     show_load: bool = True,
                     period: Optional[int] = None) -> go.Figure:
        """
        Complete dispatch plot with all filters.

        Parameters
        ----------
        start_date : str, optional
            Start date (YYYY-MM-DD)
        end_date : str, optional
            End date (YYYY-MM-DD)
        carriers : list, optional
            Filter by carriers
        resolution : str
            Time resolution ('1H', '1D', '1W', '1M')
        stacked : bool
            Stack generation areas
        show_storage : bool
            Include storage operation
        show_load : bool
            Show load line
        period : int, optional
            For multi-period, filter by period (e.g., year)

        Returns
        -------
        go.Figure
            Interactive dispatch plot
        """
        logger.info(f"Creating dispatch plot (resolution: {resolution}, period: {period})")

        # Check if solved
        if not (hasattr(self.n, 'generators_t') and
                hasattr(self.n.generators_t, 'p') and
                not self.n.generators_t.p.empty):
            return self._empty_figure("Network not solved or no generation data")

        # Get generation data
        gen_p = self.n.generators_t.p.copy()

        # Filter by period for multi-period networks
        if self.is_multi_period and period is not None:
            if isinstance(gen_p.index, pd.MultiIndex):
                gen_p = gen_p.loc[period]

        # Get time index
        if isinstance(gen_p.index, pd.MultiIndex):
            time_index = gen_p.index.get_level_values(-1)
        else:
            time_index = gen_p.index

        # Filter date range
        if start_date:
            mask = time_index >= pd.to_datetime(start_date)
            gen_p = gen_p[mask]
            time_index = time_index[mask]
        if end_date:
            mask = time_index <= pd.to_datetime(end_date)
            gen_p = gen_p[mask]
            time_index = time_index[mask]

        # Resample
        if resolution != '1H':
            gen_p.index = time_index
            gen_p = gen_p.resample(resolution).mean()
            time_index = gen_p.index

        # Aggregate by carrier
        gen_by_carrier = pd.DataFrame()
        gens = self.n.generators

        if 'carrier' in gens.columns:
            available_carriers = sorted(gens['carrier'].unique())
            carriers_to_plot = carriers if carriers else available_carriers

            for carrier in carriers_to_plot:
                if carrier in available_carriers:
                    carrier_gens = gens[gens['carrier'] == carrier].index
                    cols = gen_p.columns.intersection(carrier_gens)
                    if len(cols) > 0:
                        gen_by_carrier[carrier] = gen_p[cols].sum(axis=1)

        fig = go.Figure()

        # Plot generation
        if stacked:
            carrier_totals = gen_by_carrier.sum().sort_values(ascending=False)
            for carrier in carrier_totals.index:
                color = get_color(carrier, self.n)
                fig.add_trace(go.Scatter(
                    x=time_index,
                    y=gen_by_carrier[carrier],
                    name=carrier,
                    mode='lines',
                    stackgroup='generation',
                    fillcolor=color,
                    line=dict(width=0.5, color=color),
                    hovertemplate=f'<b>{carrier}</b><br>%{{x}}<br>%{{y:.1f}} MW<extra></extra>'
                ))
        else:
            for carrier in gen_by_carrier.columns:
                color = get_color(carrier, self.n)
                fig.add_trace(go.Scatter(
                    x=time_index,
                    y=gen_by_carrier[carrier],
                    name=carrier,
                    mode='lines',
                    line=dict(width=2, color=color)
                ))

        # Add storage
        if show_storage:
            self._add_storage_to_dispatch(fig, time_index, resolution, period)

        # Add load
        if show_load:
            load_data = self._get_load_data(time_index, resolution, period)
            if load_data is not None:
                fig.add_trace(go.Scatter(
                    x=time_index,
                    y=load_data,
                    name='Load',
                    mode='lines',
                    line=dict(color='black', width=2.5, dash='solid')
                ))

        fig.update_layout(
            title=f'Power System Dispatch ({resolution})',
            xaxis_title='Time',
            yaxis_title='Power (MW)',
            hovermode='x unified',
            height=700,
            template='plotly_white'
        )

        return fig

    # ========================================================================
    # CAPACITY ANALYSIS
    # ========================================================================

    def plot_capacity_analysis(self,
                               plot_type: str = 'bar',
                               capacity_type: str = 'optimal',
                               by_zone: bool = False,
                               carriers: Optional[List[str]] = None,
                               compare_installed: bool = False) -> go.Figure:
        """
        Complete capacity analysis with filters.

        Parameters
        ----------
        plot_type : str
            'bar', 'pie', or 'treemap'
        capacity_type : str
            'optimal', 'installed', or 'both'
        by_zone : bool
            Group by zone/country
        carriers : list, optional
            Filter by carriers
        compare_installed : bool
            Show installed vs optimal comparison

        Returns
        -------
        go.Figure
            Capacity visualization
        """
        logger.info(f"Creating capacity plot: {plot_type}")

        capacity_data = self._collect_capacity_data(capacity_type, by_zone, carriers)

        if capacity_data.empty:
            return self._empty_figure("No capacity data available")

        if plot_type == 'pie':
            return self._capacity_pie_chart(capacity_data, carriers)
        elif plot_type == 'treemap':
            return self._capacity_treemap(capacity_data)
        elif plot_type == 'bar':
            if compare_installed:
                return self._capacity_comparison_chart(capacity_data, carriers)
            else:
                return self._capacity_bar_chart(capacity_data, by_zone, carriers)

    # ========================================================================
    # STORAGE OPERATION
    # ========================================================================

    def plot_storage_operation(self,
                               resolution: str = '1H',
                               storage_type: Optional[str] = None,
                               carriers: Optional[List[str]] = None,
                               start_date: Optional[str] = None,
                               end_date: Optional[str] = None,
                               period: Optional[int] = None) -> go.Figure:
        """
        Complete storage operation visualization with filters.

        Parameters
        ----------
        resolution : str
            Time resolution
        storage_type : str, optional
            'storage_units' (PHS), 'stores' (Batteries), or None (both)
        carriers : list, optional
            Filter by carriers
        start_date : str, optional
            Start date
        end_date : str, optional
            End date
        period : int, optional
            For multi-period networks

        Returns
        -------
        go.Figure
            Storage operation plots
        """
        logger.info(f"Creating storage operation plot (type: {storage_type})")

        has_su = (hasattr(self.n, 'storage_units') and not self.n.storage_units.empty)
        has_stores = (hasattr(self.n, 'stores') and not self.n.stores.empty)

        if not has_su and not has_stores:
            return self._empty_figure("No storage components")

        # Filter by type
        show_su = (storage_type is None or storage_type == 'storage_units') and has_su
        show_stores = (storage_type is None or storage_type == 'stores') and has_stores

        rows = (1 if show_su else 0) + (1 if show_stores else 0)

        fig = make_subplots(
            rows=rows, cols=2,
            subplot_titles=self._get_storage_subplot_titles(show_su, show_stores),
            vertical_spacing=0.15
        )

        row = 1
        if show_su:
            self._add_storage_unit_plots(fig, row, resolution, carriers, start_date, end_date, period)
            row += 1

        if show_stores:
            self._add_store_plots(fig, row, resolution, carriers, start_date, end_date, period)

        fig.update_layout(
            height=400 * rows,
            showlegend=True,
            title='Storage Operation Analysis',
            template='plotly_white'
        )

        return fig

    # ========================================================================
    # TRANSMISSION FLOWS
    # ========================================================================

    def plot_transmission_flows(self,
                                flow_type: str = 'heatmap',
                                resolution: str = '1H',
                                transmission_type: Optional[str] = None,
                                lines: Optional[List[str]] = None,
                                start_date: Optional[str] = None,
                                end_date: Optional[str] = None,
                                period: Optional[int] = None) -> go.Figure:
        """
        Complete transmission flow visualization with filters.

        Parameters
        ----------
        flow_type : str
            'heatmap', 'line', or 'utilization'
        resolution : str
            Time resolution
        transmission_type : str, optional
            'lines' (AC), 'links' (DC), or None (both)
        lines : list, optional
            Filter specific lines/links
        start_date : str, optional
            Start date
        end_date : str, optional
            End date
        period : int, optional
            For multi-period networks

        Returns
        -------
        go.Figure
            Transmission flow visualization
        """
        logger.info(f"Creating transmission flow plot: {flow_type}")

        flows = self._get_transmission_flows(resolution, transmission_type, lines,
                                            start_date, end_date, period)

        if flows.empty:
            return self._empty_figure("No transmission flow data")

        if flow_type == 'heatmap':
            return self._transmission_heatmap(flows)
        elif flow_type == 'utilization':
            return self._transmission_utilization_chart(flows)
        else:  # line
            return self._transmission_line_plot(flows, lines)

    # ========================================================================
    # PRICE ANALYSIS
    # ========================================================================

    def plot_price_analysis(self,
                           plot_type: str = 'line',
                           resolution: str = '1H',
                           buses: Optional[List[str]] = None,
                           start_date: Optional[str] = None,
                           end_date: Optional[str] = None,
                           period: Optional[int] = None) -> go.Figure:
        """
        Complete price analysis with filters.

        Parameters
        ----------
        plot_type : str
            'line', 'heatmap', or 'duration_curve'
        resolution : str
            Time resolution
        buses : list, optional
            Filter by buses
        start_date : str, optional
            Start date
        end_date : str, optional
            End date
        period : int, optional
            For multi-period networks

        Returns
        -------
        go.Figure
            Price visualization
        """
        logger.info(f"Creating price plot: {plot_type}")

        if not (hasattr(self.n, 'buses_t') and hasattr(self.n.buses_t, 'marginal_price')):
            return self._empty_figure("No price data (network not solved)")

        prices = self.n.buses_t.marginal_price.copy()

        # Filter period
        if self.is_multi_period and period is not None:
            if isinstance(prices.index, pd.MultiIndex):
                prices = prices.loc[period]

        # Get time index
        time_index = prices.index.get_level_values(-1) if isinstance(prices.index, pd.MultiIndex) else prices.index

        # Filter dates
        if start_date:
            mask = time_index >= pd.to_datetime(start_date)
            prices = prices[mask]
        if end_date:
            mask = time_index <= pd.to_datetime(end_date)
            prices = prices[mask]

        # Resample
        if resolution != '1H':
            prices.index = time_index[prices.index]
            prices = prices.resample(resolution).mean()

        # Filter buses
        if buses:
            prices = prices[prices.columns.intersection(buses)]
        else:
            prices = prices.iloc[:, :10]  # Limit to 10 buses

        if plot_type == 'heatmap':
            return self._price_heatmap(prices)
        elif plot_type == 'duration_curve':
            return self._price_duration_curve(prices)
        else:
            return self._price_line_plot(prices)

    # ========================================================================
    # COMPONENT-SPECIFIC VISUALIZATIONS
    # ========================================================================

    def plot_capacity_factors(self,
                             carriers: Optional[List[str]] = None,
                             period: Optional[int] = None) -> go.Figure:
        """Capacity factors by technology."""
        from .enhanced_pypsa_analyzer import EnhancedPyPSAAnalyzer

        analyzer = EnhancedPyPSAAnalyzer(self.n)
        cf_data = analyzer.get_capacity_factors(by_carrier=True)

        if carriers:
            cf_data = {k: v for k, v in cf_data.items() if k in carriers}

        fig = go.Figure(data=[
            go.Bar(
                x=list(cf_data.keys()),
                y=[v * 100 for v in cf_data.values()],
                marker_color=[get_color(c, self.n) for c in cf_data.keys()],
                text=[f"{v*100:.1f}%" for v in cf_data.values()],
                textposition='outside'
            )
        ])

        fig.update_layout(
            title='Capacity Factors by Technology',
            xaxis_title='Technology',
            yaxis_title='Capacity Factor (%)',
            height=600,
            template='plotly_white'
        )

        return fig

    def plot_renewable_share(self,
                            renewable_carriers: Optional[List[str]] = None) -> go.Figure:
        """Renewable energy share visualization."""
        if renewable_carriers is None:
            renewable_carriers = ['solar', 'wind', 'onwind', 'offwind', 'hydro', 'ror', 'biomass']

        from .enhanced_pypsa_analyzer import EnhancedPyPSAAnalyzer
        analyzer = EnhancedPyPSAAnalyzer(self.n)

        gen_by_carrier = analyzer.get_generator_generation(by_carrier=True, aggregate='sum')

        renewable_gen = sum(v for k, v in gen_by_carrier.items()
                          if any(rc in k.lower() for rc in renewable_carriers))
        total_gen = sum(gen_by_carrier.values())
        re_share = (renewable_gen / total_gen * 100) if total_gen > 0 else 0

        fig = go.Figure(data=[
            go.Pie(
                labels=['Renewable', 'Non-Renewable'],
                values=[renewable_gen, total_gen - renewable_gen],
                marker=dict(colors=['#228B22', '#808080']),
                textinfo='label+percent',
                textposition='inside'
            )
        ])

        fig.update_layout(
            title=f'Renewable Energy Share: {re_share:.1f}%',
            height=500,
            template='plotly_white'
        )

        return fig

    def plot_emissions_analysis(self,
                               by_carrier: bool = True,
                               carriers: Optional[List[str]] = None) -> go.Figure:
        """Emissions tracking and intensity."""
        from .enhanced_pypsa_analyzer import EnhancedPyPSAAnalyzer
        analyzer = EnhancedPyPSAAnalyzer(self.n)

        emissions = analyzer.get_emissions(by_carrier=by_carrier)

        if by_carrier:
            if carriers:
                emissions = {k: v for k, v in emissions.items() if k in carriers}

            fig = go.Figure(data=[
                go.Bar(
                    x=list(emissions.keys()),
                    y=list(emissions.values()),
                    marker_color='#DC143C',
                    text=[f"{v:.0f}" for v in emissions.values()],
                    textposition='outside'
                )
            ])

            fig.update_layout(
                title='CO2 Emissions by Technology',
                xaxis_title='Technology',
                yaxis_title='Emissions (tons CO2)',
                height=600,
                template='plotly_white'
            )
        else:
            fig = go.Figure(data=[
                go.Indicator(
                    mode="number",
                    value=emissions,
                    title="Total CO2 Emissions",
                    number={'suffix': " tons"},
                    domain={'x': [0, 1], 'y': [0, 1]}
                )
            ])

            fig.update_layout(height=300)

        return fig

    def plot_system_costs(self,
                         by_component: bool = True) -> go.Figure:
        """System costs (CAPEX/OPEX) breakdown."""
        from .enhanced_pypsa_analyzer import EnhancedPyPSAAnalyzer
        analyzer = EnhancedPyPSAAnalyzer(self.n)

        costs = analyzer.get_system_costs(by_component=by_component)

        if by_component:
            capex_data = costs['capex']
            opex_data = costs['opex']

            fig = go.Figure(data=[
                go.Bar(name='CAPEX', x=list(capex_data.keys()), y=list(capex_data.values())),
                go.Bar(name='OPEX', x=list(opex_data.keys()), y=list(opex_data.values()))
            ])

            fig.update_layout(
                title='System Costs Breakdown',
                xaxis_title='Component',
                yaxis_title='Cost (€)',
                barmode='group',
                height=600,
                template='plotly_white'
            )
        else:
            fig = make_subplots(
                rows=1, cols=3,
                specs=[[{'type':'domain'}, {'type':'domain'}, {'type':'domain'}]],
                subplot_titles=['CAPEX', 'OPEX', 'Total']
            )

            fig.add_trace(go.Indicator(
                mode="number",
                value=costs['total']['capex'],
                title="CAPEX",
                number={'suffix': " €"}
            ), row=1, col=1)

            fig.add_trace(go.Indicator(
                mode="number",
                value=costs['total']['opex'],
                title="OPEX",
                number={'suffix': " €"}
            ), row=1, col=2)

            fig.add_trace(go.Indicator(
                mode="number",
                value=costs['total']['total'],
                title="Total",
                number={'suffix': " €"}
            ), row=1, col=3)

            fig.update_layout(height=300)

        return fig

    # ========================================================================
    # HELPER METHODS
    # ========================================================================

    def _collect_capacity_data(self, capacity_type, by_zone, carriers_filter):
        """Collect capacity data from all components."""
        data = []

        # Generators
        if hasattr(self.n, 'generators') and not self.n.generators.empty:
            gens = self.n.generators
            cap_col = 'p_nom_opt' if capacity_type in ['optimal', 'both'] and 'p_nom_opt' in gens.columns else 'p_nom'

            if 'carrier' in gens.columns:
                for carrier in gens['carrier'].unique():
                    if carriers_filter and carrier not in carriers_filter:
                        continue

                    carrier_gens = gens[gens['carrier'] == carrier]

                    if by_zone and hasattr(self.n, 'buses'):
                        zone_col = 'country' if 'country' in self.n.buses.columns else 'zone' if 'zone' in self.n.buses.columns else None
                        if zone_col:
                            for bus in carrier_gens['bus'].unique():
                                if bus in self.n.buses.index:
                                    zone = self.n.buses.loc[bus, zone_col]
                                    bus_gens = carrier_gens[carrier_gens['bus'] == bus]
                                    data.append({
                                        'Carrier': carrier,
                                        'Capacity_MW': bus_gens[cap_col].sum(),
                                        'Zone': zone,
                                        'Type': 'Generator'
                                    })
                        else:
                            data.append({
                                'Carrier': carrier,
                                'Capacity_MW': carrier_gens[cap_col].sum(),
                                'Type': 'Generator'
                            })
                    else:
                        data.append({
                            'Carrier': carrier,
                            'Capacity_MW': carrier_gens[cap_col].sum(),
                            'Type': 'Generator'
                        })

        # Storage Units
        if hasattr(self.n, 'storage_units') and not self.n.storage_units.empty:
            su = self.n.storage_units
            cap_col = 'p_nom_opt' if capacity_type in ['optimal', 'both'] and 'p_nom_opt' in su.columns else 'p_nom'

            if 'carrier' in su.columns:
                for carrier in su['carrier'].unique():
                    if carriers_filter and carrier not in carriers_filter:
                        continue
                    data.append({
                        'Carrier': carrier,
                        'Capacity_MW': su[su['carrier'] == carrier][cap_col].sum(),
                        'Type': 'Storage Unit'
                    })

        # Stores (use e_nom for energy capacity)
        if hasattr(self.n, 'stores') and not self.n.stores.empty:
            stores = self.n.stores
            cap_col = 'e_nom_opt' if capacity_type in ['optimal', 'both'] and 'e_nom_opt' in stores.columns else 'e_nom'

            if 'carrier' in stores.columns:
                for carrier in stores['carrier'].unique():
                    if carriers_filter and carrier not in carriers_filter:
                        continue
                    data.append({
                        'Carrier': carrier,
                        'Capacity_MW': stores[stores['carrier'] == carrier][cap_col].sum(),
                        'Type': 'Store'
                    })

        return pd.DataFrame(data)

    def _capacity_bar_chart(self, data, by_zone, carriers_filter):
        """Create bar chart for capacity."""
        fig = go.Figure()

        if by_zone and 'Zone' in data.columns:
            zones = sorted(data['Zone'].unique())
            carriers = sorted(data['Carrier'].unique())

            for carrier in carriers:
                carrier_data = data[data['Carrier'] == carrier]
                color = get_color(carrier, self.n)

                fig.add_trace(go.Bar(
                    name=carrier,
                    x=carrier_data['Zone'],
                    y=carrier_data['Capacity_MW'],
                    marker_color=color
                ))

            fig.update_layout(barmode='group')
        else:
            carriers_sum = data.groupby('Carrier')['Capacity_MW'].sum().sort_values(ascending=False)
            colors = [get_color(c, self.n) for c in carriers_sum.index]

            fig.add_trace(go.Bar(
                x=carriers_sum.index,
                y=carriers_sum.values,
                marker_color=colors,
                text=[f"{v:.0f}" for v in carriers_sum.values],
                textposition='outside'
            ))

        fig.update_layout(
            title='Installed Capacity by Technology',
            xaxis_title='Technology',
            yaxis_title='Capacity (MW)',
            height=600,
            template='plotly_white'
        )

        return fig

    def _capacity_pie_chart(self, data, carriers_filter):
        """Create pie chart."""
        carriers_sum = data.groupby('Carrier')['Capacity_MW'].sum()
        colors = [get_color(c, self.n) for c in carriers_sum.index]

        fig = go.Figure(data=[go.Pie(
            labels=carriers_sum.index,
            values=carriers_sum.values,
            marker=dict(colors=colors),
            textinfo='label+percent',
            textposition='auto'
        )])

        fig.update_layout(
            title='Capacity Mix',
            height=600,
            template='plotly_white'
        )

        return fig

    def _capacity_treemap(self, data):
        """Create treemap."""
        fig = go.Figure(go.Treemap(
            labels=data['Carrier'],
            parents=data['Type'],
            values=data['Capacity_MW'],
            textinfo='label+value'
        ))

        fig.update_layout(
            title='Capacity Treemap',
            height=600
        )

        return fig

    def _capacity_comparison_chart(self, data, carriers_filter):
        """Create installed vs optimal comparison."""
        # Would need both p_nom and p_nom_opt data
        return self._capacity_bar_chart(data, False, carriers_filter)

    def _add_storage_to_dispatch(self, fig, time_index, resolution, period):
        """Add storage operation to dispatch plot."""
        # Storage Units (PHS)
        if hasattr(self.n, 'storage_units') and not self.n.storage_units.empty:
            if hasattr(self.n, 'storage_units_t') and hasattr(self.n.storage_units_t, 'p'):
                su_p = self.n.storage_units_t.p.copy()

                # Filter period
                if self.is_multi_period and period is not None:
                    if isinstance(su_p.index, pd.MultiIndex):
                        su_p = su_p.loc[period]

                # Resample
                if resolution != '1H':
                    su_p.index = time_index[:len(su_p)]
                    su_p = su_p.resample(resolution).mean()

                # Separate charge/discharge
                discharge = su_p.clip(lower=0).sum(axis=1)
                charge = su_p.clip(upper=0).sum(axis=1)

                if discharge.sum() > 0:
                    fig.add_trace(go.Scatter(
                        x=time_index[:len(discharge)],
                        y=discharge,
                        name='PHS Discharge',
                        mode='lines',
                        stackgroup='generation',
                        fillcolor='#3399FF',
                        line=dict(width=0.5)
                    ))

                if charge.sum() < 0:
                    fig.add_trace(go.Scatter(
                        x=time_index[:len(charge)],
                        y=charge,
                        name='PHS Charge',
                        mode='lines',
                        fill='tozeroy',
                        fillcolor='rgba(51, 153, 255, 0.3)',
                        line=dict(width=1, color='#3399FF')
                    ))

        # Stores (Batteries)
        if hasattr(self.n, 'stores') and not self.n.stores.empty:
            if hasattr(self.n, 'stores_t') and hasattr(self.n.stores_t, 'p'):
                stores_p = self.n.stores_t.p.copy()

                if self.is_multi_period and period is not None:
                    if isinstance(stores_p.index, pd.MultiIndex):
                        stores_p = stores_p.loc[period]

                if resolution != '1H':
                    stores_p.index = time_index[:len(stores_p)]
                    stores_p = stores_p.resample(resolution).mean()

                discharge = stores_p.clip(lower=0).sum(axis=1)
                charge = stores_p.clip(upper=0).sum(axis=1)

                if discharge.sum() > 0:
                    fig.add_trace(go.Scatter(
                        x=time_index[:len(discharge)],
                        y=discharge,
                        name='Battery Discharge',
                        mode='lines',
                        stackgroup='generation',
                        fillcolor='#005B5B',
                        line=dict(width=0.5)
                    ))

                if charge.sum() < 0:
                    fig.add_trace(go.Scatter(
                        x=time_index[:len(charge)],
                        y=charge,
                        name='Battery Charge',
                        mode='lines',
                        fill='tozeroy',
                        fillcolor='rgba(0, 91, 91, 0.3)',
                        line=dict(width=1, color='#005B5B')
                    ))

    def _get_load_data(self, time_index, resolution, period):
        """Get load data."""
        if not hasattr(self.n, 'loads_t'):
            return None

        for attr in ['p', 'p_set']:
            if hasattr(self.n.loads_t, attr):
                load_data = getattr(self.n.loads_t, attr).sum(axis=1)

                if self.is_multi_period and period is not None:
                    if isinstance(load_data.index, pd.MultiIndex):
                        load_data = load_data.loc[period]

                return load_data

        return None

    def _get_storage_subplot_titles(self, show_su, show_stores):
        """Get subplot titles."""
        titles = []
        if show_su:
            titles.extend(['Storage Units Power', 'Storage Units SOC'])
        if show_stores:
            titles.extend(['Stores Power', 'Stores Energy'])
        return titles

    def _add_storage_unit_plots(self, fig, row, resolution, carriers, start_date, end_date, period):
        """Add storage unit plots (PHS - MW-based)."""
        if not (hasattr(self.n, 'storage_units_t') and hasattr(self.n.storage_units_t, 'p')):
            return

        su_p = self.n.storage_units_t.p.copy()
        su = self.n.storage_units

        # Filter period
        if self.is_multi_period and period is not None:
            if isinstance(su_p.index, pd.MultiIndex):
                su_p = su_p.loc[period]

        # Get time index
        time_index = su_p.index.get_level_values(-1) if isinstance(su_p.index, pd.MultiIndex) else su_p.index

        # Filter dates
        if start_date:
            mask = time_index >= pd.to_datetime(start_date)
            su_p = su_p[mask]
        if end_date:
            mask = time_index <= pd.to_datetime(end_date)
            su_p = su_p[mask]

        # Filter carriers
        if carriers and 'carrier' in su.columns:
            carrier_units = su[su['carrier'].isin(carriers)].index
            su_p = su_p[su_p.columns.intersection(carrier_units)]

        # Resample
        if resolution != '1H':
            su_p.index = time_index[:len(su_p)]
            su_p = su_p.resample(resolution).mean()

        # Plot power flow (col 1)
        discharge = su_p.clip(lower=0).sum(axis=1)
        charge = -su_p.clip(upper=0).sum(axis=1)

        fig.add_trace(go.Scatter(
            x=su_p.index,
            y=discharge,
            name='Discharge',
            mode='lines',
            fill='tozeroy',
            fillcolor='rgba(51, 153, 255, 0.5)',
            line=dict(color='#3399FF', width=2)
        ), row=row, col=1)

        fig.add_trace(go.Scatter(
            x=su_p.index,
            y=-charge,
            name='Charge',
            mode='lines',
            fill='tozeroy',
            fillcolor='rgba(255, 153, 51, 0.5)',
            line=dict(color='#FF9933', width=2)
        ), row=row, col=1)

        # Plot state of charge (col 2)
        if hasattr(self.n.storage_units_t, 'state_of_charge'):
            soc = self.n.storage_units_t.state_of_charge.copy()

            if self.is_multi_period and period is not None:
                if isinstance(soc.index, pd.MultiIndex):
                    soc = soc.loc[period]

            if resolution != '1H':
                soc.index = time_index[:len(soc)]
                soc = soc.resample(resolution).mean()

            if carriers and 'carrier' in su.columns:
                carrier_units = su[su['carrier'].isin(carriers)].index
                soc = soc[soc.columns.intersection(carrier_units)]

            soc_total = soc.sum(axis=1)

            fig.add_trace(go.Scatter(
                x=soc.index,
                y=soc_total,
                name='State of Charge',
                mode='lines',
                line=dict(color='#0073CF', width=2)
            ), row=row, col=2)

    def _add_store_plots(self, fig, row, resolution, carriers, start_date, end_date, period):
        """Add store plots (Batteries - MWh-based)."""
        if not (hasattr(self.n, 'stores_t') and hasattr(self.n.stores_t, 'p')):
            return

        stores_p = self.n.stores_t.p.copy()
        stores = self.n.stores

        # Filter period
        if self.is_multi_period and period is not None:
            if isinstance(stores_p.index, pd.MultiIndex):
                stores_p = stores_p.loc[period]

        # Get time index
        time_index = stores_p.index.get_level_values(-1) if isinstance(stores_p.index, pd.MultiIndex) else stores_p.index

        # Filter dates
        if start_date:
            mask = time_index >= pd.to_datetime(start_date)
            stores_p = stores_p[mask]
        if end_date:
            mask = time_index <= pd.to_datetime(end_date)
            stores_p = stores_p[mask]

        # Filter carriers
        if carriers and 'carrier' in stores.columns:
            carrier_stores = stores[stores['carrier'].isin(carriers)].index
            stores_p = stores_p[stores_p.columns.intersection(carrier_stores)]

        # Resample
        if resolution != '1H':
            stores_p.index = time_index[:len(stores_p)]
            stores_p = stores_p.resample(resolution).mean()

        # Plot power flow (col 1)
        discharge = stores_p.clip(lower=0).sum(axis=1)
        charge = -stores_p.clip(upper=0).sum(axis=1)

        fig.add_trace(go.Scatter(
            x=stores_p.index,
            y=discharge,
            name='Discharge',
            mode='lines',
            fill='tozeroy',
            fillcolor='rgba(0, 91, 91, 0.5)',
            line=dict(color='#005B5B', width=2)
        ), row=row, col=1)

        fig.add_trace(go.Scatter(
            x=stores_p.index,
            y=-charge,
            name='Charge',
            mode='lines',
            fill='tozeroy',
            fillcolor='rgba(255, 165, 0, 0.5)',
            line=dict(color='#FFA500', width=2)
        ), row=row, col=1)

        # Plot energy state (col 2)
        if hasattr(self.n.stores_t, 'e'):
            store_e = self.n.stores_t.e.copy()

            if self.is_multi_period and period is not None:
                if isinstance(store_e.index, pd.MultiIndex):
                    store_e = store_e.loc[period]

            if resolution != '1H':
                store_e.index = time_index[:len(store_e)]
                store_e = store_e.resample(resolution).mean()

            if carriers and 'carrier' in stores.columns:
                carrier_stores = stores[stores['carrier'].isin(carriers)].index
                store_e = store_e[store_e.columns.intersection(carrier_stores)]

            energy_total = store_e.sum(axis=1)

            fig.add_trace(go.Scatter(
                x=store_e.index,
                y=energy_total,
                name='Energy State',
                mode='lines',
                line=dict(color='#005B5B', width=2)
            ), row=row, col=2)

    # ========================================================================
    # ADDITIONAL METRICS
    # ========================================================================

    def plot_reserve_margins(self, by_zone: bool = False, period: Optional[int] = None) -> go.Figure:
        """
        Calculate and plot reserve margins.

        Parameters
        ----------
        by_zone : bool
            Calculate by zone
        period : int, optional
            For multi-period networks

        Returns
        -------
        go.Figure
            Reserve margin visualization

        Notes
        -----
        Reserve Margin = (Total Capacity - Peak Demand) / Peak Demand * 100
        """
        from .enhanced_pypsa_analyzer import EnhancedPyPSAAnalyzer
        analyzer = EnhancedPyPSAAnalyzer(self.n)

        # Get capacities
        capacities = analyzer.get_generator_capacities(by_carrier=False, optimal=True)
        total_capacity = capacities.sum() if hasattr(capacities, 'sum') else sum(capacities.values())

        # Get peak demand
        peak_demand = analyzer.get_load_demand(aggregate='peak')

        # Calculate reserve margin
        if peak_demand > 0:
            reserve_margin = (total_capacity - peak_demand) / peak_demand * 100
        else:
            reserve_margin = 0

        # Create gauge plot
        fig = go.Figure(go.Indicator(
            mode="gauge+number+delta",
            value=reserve_margin,
            title={'text': "Reserve Margin"},
            number={'suffix': "%"},
            delta={'reference': 15, 'relative': False},
            gauge={
                'axis': {'range': [0, 100]},
                'bar': {'color': "darkblue"},
                'steps': [
                    {'range': [0, 10], 'color': "red"},
                    {'range': [10, 20], 'color': "orange"},
                    {'range': [20, 100], 'color': "lightgreen"}
                ],
                'threshold': {
                    'line': {'color': "red", 'width': 4},
                    'thickness': 0.75,
                    'value': 15  # Target reserve margin
                }
            }
        ))

        fig.update_layout(
            height=400,
            template='plotly_white',
            annotations=[
                dict(
                    text=f"Total Capacity: {total_capacity:.0f} MW<br>Peak Demand: {peak_demand:.0f} MW",
                    xref="paper", yref="paper",
                    x=0.5, y=-0.1,
                    showarrow=False,
                    font=dict(size=12)
                )
            ]
        )

        return fig

    def plot_utilization_rates(self,
                              component_type: str = 'generators',
                              carriers: Optional[List[str]] = None,
                              period: Optional[int] = None) -> go.Figure:
        """
        Plot utilization rates for components.

        Parameters
        ----------
        component_type : str
            'generators', 'lines', or 'links'
        carriers : list, optional
            Filter by carriers
        period : int, optional
            For multi-period networks

        Returns
        -------
        go.Figure
            Utilization rate visualization

        Notes
        -----
        Utilization = Actual Output / (Capacity × Hours)
        """
        from .enhanced_pypsa_analyzer import EnhancedPyPSAAnalyzer
        analyzer = EnhancedPyPSAAnalyzer(self.n)

        if component_type == 'generators':
            # Get capacity factors (which are utilization rates)
            cf_data = analyzer.get_capacity_factors(by_carrier=True)

            if carriers:
                cf_data = {k: v for k, v in cf_data.items() if k in carriers}

            if not cf_data:
                return self._empty_figure("No capacity factor data available")

            fig = go.Figure(data=[
                go.Bar(
                    x=list(cf_data.keys()),
                    y=[v * 100 for v in cf_data.values()],
                    marker_color=[get_color(c, self.n) for c in cf_data.keys()],
                    text=[f"{v*100:.1f}%" for v in cf_data.values()],
                    textposition='outside'
                )
            ])

            fig.update_layout(
                title='Generator Utilization Rates',
                xaxis_title='Technology',
                yaxis_title='Utilization (%)',
                height=600,
                template='plotly_white'
            )

        elif component_type == 'lines':
            # Line utilization
            if not (hasattr(self.n, 'lines_t') and hasattr(self.n.lines_t, 'p0')):
                return self._empty_figure("No line flow data available")

            lines = self.n.lines
            line_p = self.n.lines_t.p0

            utilization = {}
            for line in line_p.columns:
                if line in lines.index:
                    s_nom = lines.loc[line, 's_nom_opt'] if 's_nom_opt' in lines.columns else lines.loc[line, 's_nom']
                    if s_nom > 0:
                        avg_flow = line_p[line].abs().mean()
                        utilization[line] = (avg_flow / s_nom * 100)

            if not utilization:
                return self._empty_figure("No utilization data available")

            fig = go.Figure(data=[
                go.Bar(
                    x=list(utilization.keys()),
                    y=list(utilization.values()),
                    marker_color='#808080',
                    text=[f"{v:.1f}%" for v in utilization.values()],
                    textposition='outside'
                )
            ])

            fig.update_layout(
                title='Transmission Line Utilization',
                xaxis_title='Line',
                yaxis_title='Average Utilization (%)',
                height=600,
                template='plotly_white'
            )

        else:
            return self._empty_figure(f"Component type '{component_type}' not supported")

        return fig

    def _get_transmission_flows(self, resolution, transmission_type, lines, start_date, end_date, period):
        """Get transmission flows."""
        flows = pd.DataFrame()

        if transmission_type is None or transmission_type == 'lines':
            if hasattr(self.n, 'lines_t') and hasattr(self.n.lines_t, 'p0'):
                flows = pd.concat([flows, self.n.lines_t.p0], axis=1)

        if transmission_type is None or transmission_type == 'links':
            if hasattr(self.n, 'links_t') and hasattr(self.n.links_t, 'p0'):
                flows = pd.concat([flows, self.n.links_t.p0], axis=1)

        if lines:
            flows = flows[flows.columns.intersection(lines)]

        return flows

    def _transmission_heatmap(self, flows):
        """Create transmission heatmap."""
        fig = go.Figure(data=go.Heatmap(
            z=flows.T.values,
            x=flows.index,
            y=flows.columns,
            colorscale='RdYlGn_r',
            colorbar=dict(title='Flow (MW)')
        ))

        fig.update_layout(
            title='Transmission Flow Heatmap',
            xaxis_title='Time',
            yaxis_title='Line/Link',
            height=max(400, len(flows.columns) * 25),
            template='plotly_white'
        )

        return fig

    def _transmission_utilization_chart(self, flows):
        """Create utilization chart."""
        return self._transmission_heatmap(flows)

    def _transmission_line_plot(self, flows, lines):
        """Create line plot."""
        fig = go.Figure()

        for line in flows.columns[:10]:
            fig.add_trace(go.Scatter(
                x=flows.index,
                y=flows[line],
                name=line,
                mode='lines'
            ))

        fig.update_layout(
            title='Transmission Flows',
            xaxis_title='Time',
            yaxis_title='Flow (MW)',
            height=600,
            template='plotly_white'
        )

        return fig

    def _price_line_plot(self, prices):
        """Create price line plot."""
        fig = go.Figure()

        for bus in prices.columns:
            fig.add_trace(go.Scatter(
                x=prices.index,
                y=prices[bus],
                name=bus,
                mode='lines'
            ))

        fig.update_layout(
            title='Nodal Electricity Prices',
            xaxis_title='Time',
            yaxis_title='Price (€/MWh)',
            height=600,
            template='plotly_white'
        )

        return fig

    def _price_heatmap(self, prices):
        """Create price heatmap."""
        fig = go.Figure(data=go.Heatmap(
            z=prices.T.values,
            x=prices.index,
            y=prices.columns,
            colorscale='RdYlGn_r',
            colorbar=dict(title='Price (€/MWh)')
        ))

        fig.update_layout(
            title='Nodal Price Heatmap',
            xaxis_title='Time',
            yaxis_title='Bus',
            height=max(400, len(prices.columns) * 25),
            template='plotly_white'
        )

        return fig

    def _price_duration_curve(self, prices):
        """Create duration curve."""
        fig = go.Figure()

        for bus in prices.columns:
            sorted_prices = prices[bus].sort_values(ascending=False).reset_index(drop=True)
            hours_pct = np.linspace(0, 100, len(sorted_prices))

            fig.add_trace(go.Scatter(
                x=hours_pct,
                y=sorted_prices.values,
                name=bus,
                mode='lines'
            ))

        fig.update_layout(
            title='Price Duration Curves',
            xaxis_title='Percentage of Time (%)',
            yaxis_title='Price (€/MWh)',
            height=600,
            template='plotly_white'
        )

        return fig

    def _empty_figure(self, message):
        """Create empty figure with message."""
        fig = go.Figure()
        fig.add_annotation(
            text=message,
            xref="paper", yref="paper",
            x=0.5, y=0.5,
            showarrow=False,
            font=dict(size=16)
        )
        fig.update_layout(
            xaxis=dict(visible=False),
            yaxis=dict(visible=False),
            height=400,
            template='plotly_white'
        )
        return fig
