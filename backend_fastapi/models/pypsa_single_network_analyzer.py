"""
PyPSA Single Network Analyzer
=============================

A class dedicated to performing detailed analysis for the single network view.
Each method corresponds to a specific data category required by the frontend.

"""

import pandas as pd

class PyPSASingleNetworkAnalyzer:
    def __init__(self, network):
        self.network = network

    def get_overview(self):
        """
        Get a high-level overview of the network.
        """
        return {
            "network_name": self.network.name,
            "num_buses": len(self.network.buses),
            "num_generators": len(self.network.generators),
    def get_buses(self):
        """
        Get detailed information about the buses in the network.
        """
        buses = self.network.buses.copy()
        if 'marginal_price' in self.network.buses_t:
            buses['avg_price'] = self.network.buses_t.marginal_price.mean()

        buses_list = buses.reset_index().to_dict(orient='records')

        price_stats = {}
        if 'marginal_price' in self.network.buses_t:
            price_stats = self.network.buses_t.marginal_price.describe().to_dict()

        return {
            "buses": buses_list,
            "voltage_levels": self.network.buses.v_nom.unique().tolist(),
            "zones": self.network.buses.zone.unique().tolist() if 'zone' in self.network.buses else [],
            "price_statistics": price_stats
        }

    def get_carriers(self):
        """
        Get detailed information about the carriers in the network.
        """
        carriers_df = self.network.carriers.copy()
        generators_df = self.network.generators

        # Calculate total capacity and number of generators per carrier
        capacity_by_carrier = generators_df.groupby('carrier')['p_nom'].sum()
        num_generators_by_carrier = generators_df.groupby('carrier').size()

        # Calculate total generation per carrier
        generation_by_carrier = self.network.generators_t.p.sum().groupby(generators_df.carrier).sum()

        # Total generation for calculating share
        total_generation = generation_by_carrier.sum()

        # Combine data into a list of dicts
        carriers_list = []
        for carrier_name, row in carriers_df.iterrows():
            total_capacity = capacity_by_carrier.get(carrier_name, 0)
            total_gen = generation_by_carrier.get(carrier_name, 0)

            carrier_data = {
                'carrier_name': carrier_name,
                'co2_emissions': row.get('co2_emissions', 0),
                'color': row.get('color', '#808080'),
                'nice_name': row.get('nice_name', carrier_name),
                'total_capacity': total_capacity,
                'total_generation': total_gen,
                'share_percentage': (total_gen / total_generation * 100) if total_generation > 0 else 0,
                'num_generators': int(num_generators_by_carrier.get(carrier_name, 0))
            }
            carriers_list.append(carrier_data)

        # Calculate total emissions and intensity
        co2_emissions_aligned = carriers_df['co2_emissions'].reindex(generation_by_carrier.index).fillna(0)
        total_emissions = (generation_by_carrier * co2_emissions_aligned).sum()
        emission_intensity = (total_emissions / total_generation) if total_generation > 0 else 0

        return {
            "carriers": carriers_list,
            "total_emissions": total_emissions,
            "emission_intensity": emission_intensity
        }

    def get_generators(self):
        """
        Get detailed information about the generators in the network.
        """
        is_solved = hasattr(self.network, 'generators_t') and 'p' in self.network.generators_t
        generators_df = self.network.generators.copy()

        # Ensure expected optional columns exist
        for col in ['p_nom_opt', 'capital_cost', 'marginal_cost', 'efficiency']:
            if col not in generators_df.columns:
                generators_df[col] = 0
        if 'p_nom_extendable' not in generators_df.columns:
            generators_df['p_nom_extendable'] = False

        if is_solved and not self.network.generators_t.p.empty:
            total_generation = self.network.generators_t.p.sum()
            num_hours = len(self.network.snapshots) * self.network.snapshot_weightings.mean()

            p_nom_for_cf = generators_df['p_nom'].replace(0, pd.NA)
            capacity_factor = (total_generation / (p_nom_for_cf * num_hours)) * 100

            generators_df['total_generation'] = total_generation
            generators_df['capacity_factor'] = capacity_factor.fillna(0)

            if 'p_max_pu' in self.network.generators_t:
                potential_gen = self.network.generators_t.p_max_pu.mul(generators_df.p_nom, axis=1).sum()
                generators_df['curtailment'] = (potential_gen - total_generation).clip(lower=0)
            else:
                generators_df['curtailment'] = 0

            generators_df['opex'] = total_generation * generators_df.marginal_cost
            generators_df['capex'] = generators_df.p_nom_opt * generators_df.capital_cost

            if 'marginal_price' in self.network.buses_t:
                prices_on_gen_buses = self.network.buses_t.marginal_price[generators_df.bus]
                revenue = (self.network.generators_t.p * prices_on_gen_buses.values).sum()
                generators_df['revenue'] = revenue
            else:
                generators_df['revenue'] = 0

        else:
            for col in ['total_generation', 'capacity_factor', 'curtailment', 'opex', 'capex', 'revenue']:
                generators_df[col] = 0

        generators_df = generators_df.reset_index().rename(columns={'index': 'generator_name'})
        generators_list = generators_df.to_dict(orient='records')

        by_carrier_summary = {}
        if is_solved and not generators_df.empty:
            by_carrier_df = generators_df.groupby('carrier').agg(
                total_capacity=('p_nom', 'sum'),
                total_generation=('total_generation', 'sum'),
                avg_capacity_factor=('capacity_factor', 'mean')
            )
            by_carrier_summary = by_carrier_df.to_dict(orient='index')

        return {
            "generators": generators_list,
            "by_carrier": by_carrier_summary
        }

    def get_loads(self):
        """
        Get detailed information about the loads in the network.
        """
        is_solved = hasattr(self.network, 'loads_t') and 'p' in self.network.loads_t
        loads_df = self.network.loads.copy()

        loads_list = []
        if is_solved and not self.network.loads_t.p.empty:
            for load_name, row in loads_df.iterrows():
                load_series = self.network.loads_t.p[load_name]
                total_demand = load_series.sum()
                peak_demand = load_series.max()
                avg_demand = load_series.mean()
                load_factor = (avg_demand / peak_demand * 100) if peak_demand > 0 else 0

                # NOTE: Including full time series can be large.
                # Consider downsampling or omitting in production for very large datasets.
                time_series_df = load_series.reset_index().rename(columns={'index': 'timestamp', load_name: 'power_mw'})

                loads_list.append({
                    'load_name': load_name,
                    'bus': row.bus,
                    'carrier': row.carrier,
                    'total_demand': total_demand,
                    'peak_demand': peak_demand,
                    'avg_demand': avg_demand,
                    'load_factor': load_factor,
                    'time_series': time_series_df.to_dict('records')
                })

        # Calculate overall stats
        total_demand_overall = 0
        peak_demand_overall = 0
        load_duration_curve = []
        demand_by_carrier = {}

        if is_solved and not self.network.loads_t.p.empty:
            total_load_series = self.network.loads_t.p.sum(axis=1)
            total_demand_overall = total_load_series.sum()
            peak_demand_overall = total_load_series.max()

            # Load duration curve
            ldc_series = total_load_series.sort_values(ascending=False).reset_index(drop=True)
            ldc_df = ldc_series.reset_index().rename(columns={'index': 'hour', 0: 'demand_mw'})
            load_duration_curve = ldc_df.to_dict('records')

            # Demand by carrier
            demand_by_carrier_series = self.network.loads_t.p.sum().groupby(self.network.loads.carrier).sum()
            demand_by_carrier = demand_by_carrier_series.to_dict()

        return {
            "loads": loads_list,
            "total_demand": total_demand_overall,
            "peak_demand": peak_demand_overall,
            "load_duration_curve": load_duration_curve,
            "demand_by_carrier": demand_by_carrier
        }

    def get_storage_units(self):
        """
        Get detailed information about the storage units in the network.
        """
        is_solved = hasattr(self.network, 'storage_units_t') and 'p' in self.network.storage_units_t
        storage_units_df = self.network.storage_units.copy()

        if is_solved and not self.network.storage_units_t.p.empty:
            dispatch_total = self.network.storage_units_t.p.where(self.network.storage_units_t.p > 0).sum()
            store_total = -self.network.storage_units_t.p.where(self.network.storage_units_t.p < 0).sum()

            storage_units_df['dispatch_total'] = dispatch_total
            storage_units_df['store_total'] = store_total

            if 'marginal_price' in self.network.buses_t:
                prices_on_bus = self.network.buses_t.marginal_price[storage_units_df.bus]
                revenue = (self.network.storage_units_t.p * prices_on_bus.values).sum()
                storage_units_df['revenue'] = revenue
            else:
                storage_units_df['revenue'] = 0

            # Calculate cycles, assuming one full cycle per day on average if not otherwise specified
            num_days = len(self.network.snapshots) / 24
            storage_units_df['cycles'] = (store_total / storage_units_df['p_nom']).fillna(0) / num_days

        else:
            for col in ['dispatch_total', 'store_total', 'revenue', 'cycles']:
                storage_units_df[col] = 0

        storage_units_list = storage_units_df.reset_index().rename(columns={'index': 'storage_unit_name'}).to_dict('records')

        total_power_capacity = storage_units_df.p_nom.sum()
        total_energy_capacity = (storage_units_df.p_nom * storage_units_df.max_hours).sum()

        # Weighted average efficiency
        if not storage_units_df.empty and storage_units_df.p_nom.sum() > 0:
            avg_efficiency = (storage_units_df.efficiency_dispatch * storage_units_df.p_nom).sum() / storage_units_df.p_nom.sum()
        else:
            avg_efficiency = 0

        return {
            "storage_units": storage_units_list,
            "total_power_capacity": total_power_capacity,
            "total_energy_capacity": total_energy_capacity,
            "avg_efficiency": avg_efficiency
        }

    def get_stores(self):
        """
        Get detailed information about the stores (e.g., batteries) in the network.
        """
        is_solved = hasattr(self.network, 'stores_t') and 'p' in self.network.stores_t
        stores_df = self.network.stores.copy()

        stores_list = []
        total_cycles = 0

        # Ensure optional columns exist
        for col in ['e_nom_opt', 'capital_cost', 'standing_loss']:
            if col not in stores_df.columns:
                stores_df[col] = 0
        if 'e_cyclic' not in stores_df.columns:
            stores_df[col] = False

        if is_solved and not self.network.stores_t.p.empty:
            for store_name, row in stores_df.iterrows():
                store_p = self.network.stores_t.p[store_name]
                store_e = self.network.stores_t.e[store_name]

                charging_total = -store_p.where(store_p < 0).sum()
                discharging_total = store_p.where(store_p > 0).sum()

                cycles = (charging_total / row.e_nom) if row.e_nom > 0 else 0
                total_cycles += cycles

                soc_df = store_e.reset_index().rename(columns={'index': 'timestamp', store_name: 'soc_mwh'})

                dod = ((row.e_nom - store_e.min()) / row.e_nom * 100) if row.e_nom > 0 else 0

                stores_list.append({
                    'store_name': store_name,
                    'bus': row.bus,
                    'carrier': row.carrier,
                    'e_nom': row.e_nom,
                    'e_nom_opt': row.e_nom_opt,
                    'e_cyclic': row.e_cyclic,
                    'e_initial': row.e_initial,
                    'capital_cost': row.capital_cost,
                    'standing_loss': row.standing_loss,
                    'charging_total': charging_total,
                    'discharging_total': discharging_total,
                    'state_of_charge': soc_df.to_dict('records'),
                    'cycles': cycles,
                    'depth_of_discharge': dod
                })

        total_energy_capacity = stores_df.e_nom.sum()

        return {
            "stores": stores_list,
            "total_energy_capacity": total_energy_capacity,
            "total_cycles": total_cycles
        }

    def get_links(self):
        """
        Get detailed information about the links (e.g., DC lines) in the network.
        """
        is_solved = hasattr(self.network, 'links_t') and 'p0' in self.network.links_t
        links_df = self.network.links.copy()

        # Ensure optional columns exist
        for col in ['p_nom_opt', 'length', 'capital_cost', 'efficiency']:
            if col not in links_df.columns:
                links_df[col] = 0
        if 'reversible' not in links_df.columns:
            links_df['reversible'] = False

        if is_solved and not self.network.links_t.p0.empty:
            p_flow = self.network.links_t.p0.abs().sum()

            # Utilization
            p_nom_for_util = links_df['p_nom'].replace(0, pd.NA)
            num_hours = len(self.network.snapshots)
            utilization = (p_flow / (p_nom_for_util * num_hours)) * 100

            # Congestion
            is_congested = self.network.links_t.p0.abs() >= (links_df.p_nom * 0.99)
            congestion_hours = is_congested.sum()

            links_df['p_flow'] = p_flow
            links_df['utilization'] = utilization.fillna(0)
            links_df['congestion_hours'] = congestion_hours
        else:
            for col in ['p_flow', 'utilization', 'congestion_hours']:
                links_df[col] = 0

        links_list = links_df.reset_index().rename(columns={'index': 'link_name'}).to_dict('records')

        # Summary stats
        total_capacity = links_df.p_nom.sum()
        avg_utilization = 0
        if total_capacity > 0:
            avg_utilization = (links_df['utilization'] * links_df['p_nom']).sum() / total_capacity

        by_carrier_summary = {}
        if is_solved and not links_df.empty:
            by_carrier_df = links_df.groupby('carrier').agg(
                capacity=('p_nom', 'sum'),
                flow=('p_flow', 'sum')
            )
            by_carrier_summary = by_carrier_df.to_dict(orient='index')

        return {
            "links": links_list,
            "total_capacity": total_capacity,
            "avg_utilization": avg_utilization,
            "by_carrier": by_carrier_summary
        }

    def get_lines(self):
        """
        Get detailed information about the AC transmission lines in the network.
        """
        is_solved = hasattr(self.network, 'lines_t') and 'p0' in self.network.lines_t
        lines_df = self.network.lines.copy()

        # Ensure optional columns exist
        for col in ['s_nom_opt', 'capital_cost', 'type', 'r', 'x']:
            if col not in lines_df.columns:
                lines_df[col] = 0

        if is_solved and not self.network.lines_t.p0.empty:
            p_flow = self.network.lines_t.p0.abs().sum()
            losses = (self.network.lines_t.p0 + self.network.lines_t.p1).sum()

            s_nom_for_util = lines_df['s_nom'].replace(0, pd.NA)
            num_hours = len(self.network.snapshots)
            utilization = (self.network.lines_t.p0.abs().mean() / s_nom_for_util) * 100

            is_congested = self.network.lines_t.p0.abs() >= (lines_df.s_nom * 0.99)
            congestion_hours = is_congested.sum()

            lines_df['p_flow'] = p_flow
            lines_df['utilization'] = utilization.fillna(0)
            lines_df['congestion_hours'] = congestion_hours
            lines_df['losses'] = losses
        else:
            for col in ['p_flow', 'utilization', 'congestion_hours', 'losses']:
                lines_df[col] = 0

        lines_list = lines_df.reset_index().rename(columns={'index': 'line_name'}).to_dict('records')

        # Summary stats
        total_capacity = lines_df.s_nom.sum()
        total_losses = lines_df.losses.sum()
        avg_utilization = 0
        if total_capacity > 0:
            avg_utilization = (lines_df['utilization'] * lines_df['s_nom']).sum() / total_capacity

        congested_lines = (lines_df.congestion_hours > 0).sum()

        return {
            "lines": lines_list,
            "total_capacity": total_capacity,
            "total_losses": total_losses,
            "avg_utilization": avg_utilization,
            "congested_lines": int(congested_lines)
        }

    def get_transformers(self):
        """
        Get detailed information about the transformers in the network.
        """
        is_solved = hasattr(self.network, 'transformers_t') and 'p0' in self.network.transformers_t
        transformers_df = self.network.transformers.copy()

        # Ensure optional columns exist
        for col in ['s_nom_opt', 'capital_cost', 'type', 'tap_ratio', 'phase_shift']:
            if col not in transformers_df.columns:
                transformers_df[col] = 0

        if is_solved and not self.network.transformers_t.p0.empty:
            p_flow = self.network.transformers_t.p0.abs().sum()
            losses = (self.network.transformers_t.p0 + self.network.transformers_t.p1).sum()

            s_nom_for_util = transformers_df['s_nom'].replace(0, pd.NA)
            utilization = (self.network.transformers_t.p0.abs().mean() / s_nom_for_util) * 100

            transformers_df['p_flow'] = p_flow
            transformers_df['utilization'] = utilization.fillna(0)
            transformers_df['losses'] = losses
        else:
            for col in ['p_flow', 'utilization', 'losses']:
                transformers_df[col] = 0

        transformers_list = transformers_df.reset_index().rename(columns={'index': 'transformer_name'}).to_dict('records')

        total_capacity = transformers_df.s_nom.sum()
        total_losses = transformers_df.losses.sum()

        return {
            "transformers": transformers_list,
            "total_capacity": total_capacity,
            "total_losses": total_losses
        }

    def get_global_constraints(self):
        """
        Get information about global constraints in the network.
        """
        is_solved = hasattr(self.network, 'global_constraints') and not self.network.global_constraints.empty
        constraints_df = self.network.global_constraints.copy() if is_solved else pd.DataFrame()

        if is_solved:
            constraints_df['actual_value'] = self.network.global_constraints.mu
            constraints_df['shadow_price'] = self.network.global_constraints.shadow_price
            constraints_df['slack'] = self.network.global_constraints.slack
            constraints_df['binding'] = constraints_df['slack'].abs() < 1e-6 # A small tolerance for binding
        else:
            for col in ['actual_value', 'shadow_price', 'slack', 'binding']:
                constraints_df[col] = 0

        constraints_list = constraints_df.reset_index().rename(columns={'index': 'constraint_name'}).to_dict('records')

        # Extract specific CO2 info if available
        co2_limit = None
        co2_emissions = None
        co2_shadow_price = None
        if 'CO2Limit' in constraints_df.index:
            co2_constraint = constraints_df.loc['CO2Limit']
            co2_limit = co2_constraint.get('constant')
            co2_emissions = co2_constraint.get('actual_value')
            co2_shadow_price = co2_constraint.get('shadow_price')

        return {
            "constraints": constraints_list,
            "co2_limit": co2_limit,
            "co2_emissions": co2_emissions,
            "co2_shadow_price": co2_shadow_price
        }

    def get_capacity_factors(self):
        """
        Get capacity factors (utilization) for all generators.
        """
        is_solved = hasattr(self.network, 'generators_t') and 'p' in self.network.generators_t
        generators_df = self.network.generators.copy()

        capacity_factors_list = []
        by_carrier_summary = {}

        if is_solved and not self.network.generators_t.p.empty:
            actual_generation = self.network.generators_t.p.sum()
            num_hours = len(self.network.snapshots) * self.network.snapshot_weightings.mean()

            p_nom_eff = generators_df['p_nom'].replace(0, pd.NA)
            potential_generation = p_nom_eff * num_hours

            capacity_factor = (actual_generation / potential_generation) * 100

            cf_df = pd.DataFrame({
                'carrier': generators_df.carrier,
                'technology': generators_df.index,
                'capacity_factor': capacity_factor.fillna(0),
                'total_capacity': generators_df.p_nom,
                'actual_generation': actual_generation,
                'potential_generation': potential_generation.fillna(0)
            })

            capacity_factors_list = cf_df.to_dict(orient='records')

            weighted_cf = cf_df['capacity_factor'] * cf_df['total_capacity']
            carrier_capacity = cf_df.groupby('carrier')['total_capacity'].sum()

            safe_carrier_capacity = carrier_capacity.replace(0, pd.NA)

            avg_cf_by_carrier = weighted_cf.groupby(cf_df['carrier']).sum() / safe_carrier_capacity
            by_carrier_summary = avg_cf_by_carrier.fillna(0).to_dict()

        return {
            "capacity_factors": capacity_factors_list,
            "by_carrier": by_carrier_summary
        }

    def get_renewable_share(self):
        """
        Calculate the share of renewable energy in the generation mix.
        """
        is_solved = hasattr(self.network, 'generators_t') and 'p' in self.network.generators_t

        if not is_solved or self.network.generators_t.p.empty:
            return {
                "renewable_generation": 0, "total_generation": 0, "renewable_share": 0,
                "by_technology": [], "renewable_carriers": [], "fossil_carriers": []
            }

        # Identify renewable and fossil carriers based on CO2 emissions
        renewable_carriers = self.network.carriers[self.network.carriers.co2_emissions == 0].index.tolist()
        fossil_carriers = self.network.carriers[self.network.carriers.co2_emissions > 0].index.tolist()

        generation_by_carrier = self.network.generators_t.p.sum().groupby(self.network.generators.carrier).sum()

        renewable_generation = generation_by_carrier[generation_by_carrier.index.isin(renewable_carriers)].sum()
        total_generation = generation_by_carrier.sum()
        renewable_share = (renewable_generation / total_generation * 100) if total_generation > 0 else 0

        # Share by technology
        gen_df = pd.DataFrame({'generation': generation_by_carrier})
        gen_df['share'] = (gen_df.generation / total_generation * 100)
        gen_df = gen_df[gen_df.index.isin(renewable_carriers)]

        by_technology = gen_df.reset_index().rename(columns={'index': 'technology'}).to_dict('records')

        return {
            "renewable_generation": renewable_generation,
            "total_generation": total_generation,
            "renewable_share": renewable_share,
            "by_technology": by_technology,
            "renewable_carriers": renewable_carriers,
            "fossil_carriers": fossil_carriers
        }

    def get_system_costs(self):
        """
        Get a detailed breakdown of system costs (CAPEX and OPEX).
        """
        is_solved = hasattr(self.network, 'generators_t')

        capex_total = 0
        opex_total = 0
        by_component = []

        # Helper function to get costs for a component
        def get_component_costs(component_name, df, p_nom_col='p_nom_opt'):
            df_copy = df.copy()
            if 'capital_cost' not in df_copy.columns: df_copy['capital_cost'] = 0
            if 'marginal_cost' not in df_copy.columns: df_copy['marginal_cost'] = 0

            # CAPEX
            capex = (df_copy[p_nom_col] * df_copy['capital_cost']).sum()

            # OPEX
            if hasattr(self.network, f'{component_name}_t') and 'p' in getattr(self.network, f'{component_name}_t'):
                generation = getattr(self.network, f'{component_name}_t').p.sum()
                opex = (generation * df_copy.marginal_cost).sum()
            else:
                opex = 0

            # Breakdown
            df_copy['capex'] = df_copy[p_nom_col] * df_copy['capital_cost']
            if hasattr(self.network, f'{component_name}_t') and 'p' in getattr(self.network, f'{component_name}_t'):
                 df_copy['opex'] = getattr(self.network, f'{component_name}_t').p.sum() * df_copy.marginal_cost
            else:
                 df_copy['opex'] = 0
            df_copy['total'] = df_copy['capex'] + df_copy['opex']

            breakdown = df_copy.groupby('carrier')[['capex', 'opex', 'total']].sum().reset_index()
            breakdown['component_type'] = component_name.capitalize()

            return capex, opex, breakdown

        if is_solved:
            # Generators
            capex_gen, opex_gen, breakdown_gen = get_component_costs('generators', self.network.generators)
            capex_total += capex_gen
            opex_total += opex_gen
            by_component.extend(breakdown_gen.to_dict('records'))

            # Storage Units
            capex_su, opex_su, breakdown_su = get_component_costs('storage_units', self.network.storage_units)
            capex_total += capex_su
            opex_total += opex_su
            by_component.extend(breakdown_su.to_dict('records'))

            # Other components can be added here (lines, links, stores)

        total_cost = capex_total + opex_total
        total_generation = self.network.generators_t.p.sum().sum()
        levelized_cost = (total_cost / total_generation) if total_generation > 0 else 0

        num_years = len(self.network.investment_periods) if hasattr(self.network, 'investment_periods') else 1
        annual_cost = total_cost / num_years

        return {
            "total_cost": total_cost,
            "capex_total": capex_total,
            "opex_total": opex_total,
            "by_component": by_component,
            "levelized_cost": levelized_cost,
            "annual_cost": annual_cost
        }

    def get_emissions_tracking(self):
        """
        Get detailed emissions data, including time series.
        """
        is_solved = hasattr(self.network, 'generators_t') and 'p' in self.network.generators_t
        if not is_solved or self.network.generators_t.p.empty:
            return {
                "total_emissions": 0, "emission_intensity": 0,
                "by_carrier": [], "time_series": []
            }

        generation_by_carrier = self.network.generators_t.p.sum().groupby(self.network.generators.carrier).sum()
        co2_emissions_factors = self.network.carriers['co2_emissions'].reindex(generation_by_carrier.index).fillna(0)

        emissions_by_carrier = generation_by_carrier * co2_emissions_factors
        total_emissions = emissions_by_carrier.sum()
        total_generation = generation_by_carrier.sum()
        emission_intensity = (total_emissions / total_generation) if total_generation > 0 else 0

        # By carrier breakdown
        by_carrier_df = pd.DataFrame({
            'emissions': emissions_by_carrier,
            'generation': generation_by_carrier,
            'intensity': (emissions_by_carrier / generation_by_carrier).fillna(0)
        })
        by_carrier_list = by_carrier_df.reset_index().rename(columns={'index': 'carrier'}).to_dict('records')

        # Time series of emissions
        gen_p_t = self.network.generators_t.p
        emissions_t = (gen_p_t.T.groupby(self.network.generators.carrier).sum().T * co2_emissions_factors).sum(axis=1)

        time_series_df = emissions_t.reset_index().rename(columns={'index': 'timestamp', 0: 'emissions_tco2'})
        time_series_list = time_series_df.to_dict('records')

        return {
            "total_emissions": total_emissions,
            "emission_intensity": emission_intensity,
            "by_carrier": by_carrier_list,
            "time_series": time_series_list
        }

    def get_reserve_margins(self):
        """
        Calculate system reliability metrics like reserve margin.
        """
        is_solved = hasattr(self.network, 'generators_t') and 'p' in self.network.generators_t
        if not is_solved or self.network.loads_t.p.empty:
            return {
                "total_capacity": 0, "peak_demand": 0, "reserve_margin": 0,
                "by_carrier": [], "firm_capacity": 0, "variable_capacity": 0
            }

        total_capacity = self.network.generators.p_nom.sum()
        peak_demand = self.network.loads_t.p.sum(axis=1).max()
        reserve_margin = ((total_capacity - peak_demand) / peak_demand * 100) if peak_demand > 0 else 0

        # By carrier breakdown
        by_carrier_df = self.network.generators.groupby('carrier')['p_nom'].sum().reset_index()
        by_carrier_df = by_carrier_df.rename(columns={'p_nom': 'capacity'})
        by_carrier_df['margin'] = ((by_carrier_df.capacity / total_capacity) * reserve_margin)
        by_carrier_list = by_carrier_df.to_dict('records')

        # Firm vs Variable capacity
        variable_carriers = self.network.carriers[self.network.carriers.co2_emissions == 0].index
        variable_capacity = self.network.generators[self.network.generators.carrier.isin(variable_carriers)].p_nom.sum()
        firm_capacity = total_capacity - variable_capacity

        return {
            "total_capacity": total_capacity,
            "peak_demand": peak_demand,
            "reserve_margin": reserve_margin,
            "by_carrier": by_carrier_list,
            "firm_capacity": firm_capacity,
            "variable_capacity": variable_capacity
        }

    def get_dispatch_analysis(self):
        """
        Get time series data for dispatch analysis, including generation by carrier,
        storage charge/discharge, and load.
        """
        is_solved = (
            hasattr(self.network, 'generators_t') and 'p' in self.network.generators_t and
            hasattr(self.network, 'loads_t') and 'p' in self.network.loads_t
        )

        if not is_solved:
            return {"time_series": [], "carriers": [], "duration_hours": 0}

        # Generation by carrier
        gen_by_carrier = self.network.generators_t.p.T.groupby(self.network.generators.carrier).sum().T

        # Storage
        storage_charge = pd.Series(0, index=self.network.snapshots)
        storage_discharge = pd.Series(0, index=self.network.snapshots)

        if hasattr(self.network, 'storage_units_t') and 'p' in self.network.storage_units_t:
            su_p = self.network.storage_units_t.p
            storage_charge += -su_p.where(su_p < 0).sum(axis=1)
            storage_discharge += su_p.where(su_p > 0).sum(axis=1)

        if hasattr(self.network, 'stores_t') and 'p' in self.network.stores_t:
            st_p = self.network.stores_t.p
            storage_charge += -st_p.where(st_p < 0).sum(axis=1)
            storage_discharge += st_p.where(st_p > 0).sum(axis=1)

        # Load
        load = self.network.loads_t.p.sum(axis=1)

        # Combine into a single DataFrame
        dispatch_df = gen_by_carrier.copy()
        dispatch_df['storage_charge'] = -storage_charge
        dispatch_df['storage_discharge'] = storage_discharge
        dispatch_df['load'] = load

        # Reshape for response
        time_series_list = []
        for timestamp, row in dispatch_df.iterrows():
            gen_dict = {carrier: val for carrier, val in row.items() if carrier not in ['storage_charge', 'storage_discharge', 'load']}
            time_series_list.append({
                'timestamp': str(timestamp),
                'generation_by_carrier': gen_dict,
                'storage_charge': row.storage_charge,
                'storage_discharge': row.storage_discharge,
                'load': row.load
            })

        carriers = gen_by_carrier.columns.tolist()
        carriers.append('storage')

        return {
            "time_series": time_series_list,
            "carriers": carriers,
            "duration_hours": len(self.network.snapshots)
        }
