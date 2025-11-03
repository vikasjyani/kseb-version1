"""
PyPSA Component Detail Routes
==============================

API endpoints for detailed component-level analysis.
These endpoints provide granular data for each PyPSA component type.

Expected by frontend: SingleNetworkView.jsx
"""

from fastapi import APIRouter, HTTPException, Query
from pathlib import Path
from typing import List, Dict, Any, Optional
import logging
import pandas as pd

import sys
sys.path.append(str(Path(__file__).parent.parent / "models"))

from network_cache import load_network_cached

logger = logging.getLogger(__name__)
router = APIRouter()


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def safe_float(value) -> Optional[float]:
    """Convert value to float safely."""
    try:
        if pd.isna(value):
            return None
        return float(value)
    except:
        return None


def safe_int(value) -> Optional[int]:
    """Convert value to int safely."""
    try:
        if pd.isna(value):
            return None
        return int(value)
    except:
        return None


# =============================================================================
# NETWORK OVERVIEW
# =============================================================================

@router.get("/pypsa/overview")
async def get_network_overview(
    projectPath: str = Query(...),
    scenarioName: str = Query(...),
    networkFile: str = Query(...)
):
    """
    Get comprehensive network overview with key metrics.

    Returns component counts, capacities, and generation totals.
    """
    try:
        network_path = Path(projectPath) / "results" / "pypsa_optimization" / scenarioName / networkFile

        if not network_path.exists():
            raise HTTPException(status_code=404, detail=f"Network file not found: {networkFile}")

        network = load_network_cached(str(network_path))

        # Component counts
        overview = {
            "success": True,
            "network_name": getattr(network, 'name', networkFile.replace('.nc', '')),
            "num_buses": len(network.buses) if hasattr(network, 'buses') else 0,
            "num_generators": len(network.generators) if hasattr(network, 'generators') else 0,
            "num_loads": len(network.loads) if hasattr(network, 'loads') else 0,
            "num_storage_units": len(network.storage_units) if hasattr(network, 'storage_units') else 0,
            "num_stores": len(network.stores) if hasattr(network, 'stores') else 0,
            "num_lines": len(network.lines) if hasattr(network, 'lines') else 0,
            "num_links": len(network.links) if hasattr(network, 'links') else 0,
            "num_transformers": len(network.transformers) if hasattr(network, 'transformers') else 0
        }

        # Total capacity
        total_capacity = 0
        if hasattr(network, 'generators') and not network.generators.empty:
            if 'p_nom_opt' in network.generators.columns:
                total_capacity = network.generators['p_nom_opt'].sum()
            elif 'p_nom' in network.generators.columns:
                total_capacity = network.generators['p_nom'].sum()

        overview["total_capacity_mw"] = safe_float(total_capacity)

        # Total generation
        total_generation = 0
        if hasattr(network, 'generators_t') and hasattr(network.generators_t, 'p'):
            total_generation = network.generators_t.p.sum().sum()

        overview["total_generation_mwh"] = safe_float(total_generation)

        # Peak load
        peak_load = 0
        if hasattr(network, 'loads_t') and hasattr(network.loads_t, 'p'):
            peak_load = network.loads_t.p.sum(axis=1).max()

        overview["peak_load_mw"] = safe_float(peak_load)

        return overview

    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Error getting network overview: {error}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(error))


# =============================================================================
# BUSES
# =============================================================================

@router.get("/pypsa/buses")
async def get_buses(
    projectPath: str = Query(...),
    scenarioName: str = Query(...),
    networkFile: str = Query(...)
):
    """Get detailed bus information including voltage levels and prices."""
    try:
        network_path = Path(projectPath) / "results" / "pypsa_optimization" / scenarioName / networkFile

        if not network_path.exists():
            raise HTTPException(status_code=404, detail=f"Network file not found: {networkFile}")

        network = load_network_cached(str(network_path))

        if not hasattr(network, 'buses') or network.buses.empty:
            return {"success": True, "buses": [], "voltage_levels": [], "zones": []}

        buses_data = []
        for idx, bus in network.buses.iterrows():
            bus_info = {
                "bus_name": idx,
                "voltage_level": safe_float(bus.get('v_nom', None)),
                "zone": str(bus.get('country', bus.get('zone', 'N/A'))),
                "carrier": str(bus.get('carrier', 'AC')),
                "x_coord": safe_float(bus.get('x', None)),
                "y_coord": safe_float(bus.get('y', None))
            }

            # Add average marginal price if available
            if hasattr(network, 'buses_t') and hasattr(network.buses_t, 'marginal_price'):
                if idx in network.buses_t.marginal_price.columns:
                    prices = network.buses_t.marginal_price[idx]
                    bus_info["avg_price"] = safe_float(prices.mean())
                    bus_info["marginal_price"] = safe_float(prices.iloc[-1]) if len(prices) > 0 else None

            buses_data.append(bus_info)

        # Get unique voltage levels and zones
        voltage_levels = sorted([v for v in network.buses['v_nom'].unique() if pd.notna(v)])

        zones = []
        if 'country' in network.buses.columns:
            zones = sorted([z for z in network.buses['country'].unique() if pd.notna(z)])
        elif 'zone' in network.buses.columns:
            zones = sorted([z for z in network.buses['zone'].unique() if pd.notna(z)])

        # Price statistics
        price_stats = {}
        if hasattr(network, 'buses_t') and hasattr(network.buses_t, 'marginal_price'):
            all_prices = network.buses_t.marginal_price.values.flatten()
            all_prices = all_prices[~pd.isna(all_prices)]
            if len(all_prices) > 0:
                price_stats = {
                    "min": safe_float(all_prices.min()),
                    "max": safe_float(all_prices.max()),
                    "avg": safe_float(all_prices.mean()),
                    "std": safe_float(all_prices.std())
                }

        return {
            "success": True,
            "buses": buses_data,
            "voltage_levels": voltage_levels,
            "zones": zones,
            "price_statistics": price_stats
        }

    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Error getting buses: {error}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(error))


# =============================================================================
# CARRIERS
# =============================================================================

@router.get("/pypsa/carriers")
async def get_carriers(
    projectPath: str = Query(...),
    scenarioName: str = Query(...),
    networkFile: str = Query(...)
):
    """Get carrier information including emissions and colors."""
    try:
        network_path = Path(projectPath) / "results" / "pypsa_optimization" / scenarioName / networkFile

        if not network_path.exists():
            raise HTTPException(status_code=404, detail=f"Network file not found: {networkFile}")

        network = load_network_cached(str(network_path))

        carriers_data = []
        total_emissions = 0

        if hasattr(network, 'carriers') and not network.carriers.empty:
            # Get generation by carrier
            carrier_generation = {}
            carrier_capacity = {}
            carrier_count = {}

            if hasattr(network, 'generators') and not network.generators.empty:
                for carrier in network.generators['carrier'].unique():
                    carrier_gens = network.generators[network.generators['carrier'] == carrier]
                    carrier_count[carrier] = len(carrier_gens)

                    # Capacity
                    if 'p_nom_opt' in carrier_gens.columns:
                        carrier_capacity[carrier] = carrier_gens['p_nom_opt'].sum()
                    elif 'p_nom' in carrier_gens.columns:
                        carrier_capacity[carrier] = carrier_gens['p_nom'].sum()

                    # Generation
                    if hasattr(network, 'generators_t') and hasattr(network.generators_t, 'p'):
                        gen_names = carrier_gens.index.intersection(network.generators_t.p.columns)
                        if len(gen_names) > 0:
                            carrier_generation[carrier] = network.generators_t.p[gen_names].sum().sum()

            total_gen = sum(carrier_generation.values())

            for idx, carrier in network.carriers.iterrows():
                carrier_info = {
                    "carrier_name": idx,
                    "co2_emissions": safe_float(carrier.get('co2_emissions', 0)),
                    "color": str(carrier.get('color', '#808080')),
                    "nice_name": str(carrier.get('nice_name', idx)),
                    "total_capacity": safe_float(carrier_capacity.get(idx, 0)),
                    "total_generation": safe_float(carrier_generation.get(idx, 0)),
                    "share_percentage": safe_float((carrier_generation.get(idx, 0) / total_gen * 100) if total_gen > 0 else 0),
                    "num_generators": safe_int(carrier_count.get(idx, 0))
                }

                carriers_data.append(carrier_info)

                # Calculate emissions
                co2 = carrier.get('co2_emissions', 0)
                gen = carrier_generation.get(idx, 0)
                total_emissions += co2 * gen

        emission_intensity = (total_emissions / sum(carrier_generation.values())) if carrier_generation else 0

        return {
            "success": True,
            "carriers": carriers_data,
            "total_emissions": safe_float(total_emissions),
            "emission_intensity": safe_float(emission_intensity)
        }

    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Error getting carriers: {error}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(error))


# =============================================================================
# GENERATORS
# =============================================================================

@router.get("/pypsa/generators")
async def get_generators(
    projectPath: str = Query(...),
    scenarioName: str = Query(...),
    networkFile: str = Query(...)
):
    """Get detailed generator information."""
    try:
        network_path = Path(projectPath) / "results" / "pypsa_optimization" / scenarioName / networkFile

        if not network_path.exists():
            raise HTTPException(status_code=404, detail=f"Network file not found: {networkFile}")

        network = load_network_cached(str(network_path))

        if not hasattr(network, 'generators') or network.generators.empty:
            return {"success": True, "generators": [], "by_carrier": {}}

        generators_data = []
        by_carrier = {}

        for idx, gen in network.generators.iterrows():
            gen_info = {
                "generator_name": idx,
                "bus": str(gen.get('bus', '')),
                "carrier": str(gen.get('carrier', '')),
                "p_nom": safe_float(gen.get('p_nom', 0)),
                "p_nom_opt": safe_float(gen.get('p_nom_opt', gen.get('p_nom', 0))),
                "p_nom_extendable": bool(gen.get('p_nom_extendable', False)),
                "capital_cost": safe_float(gen.get('capital_cost', 0)),
                "marginal_cost": safe_float(gen.get('marginal_cost', 0)),
                "efficiency": safe_float(gen.get('efficiency', 1.0))
            }

            # Calculate generation if time series available
            if hasattr(network, 'generators_t') and hasattr(network.generators_t, 'p'):
                if idx in network.generators_t.p.columns:
                    gen_series = network.generators_t.p[idx]
                    total_gen = gen_series.sum()
                    gen_info["total_generation"] = safe_float(total_gen)

                    # Capacity factor
                    capacity = gen_info["p_nom_opt"] or gen_info["p_nom"]
                    if capacity > 0:
                        hours = len(gen_series)
                        gen_info["capacity_factor"] = safe_float(total_gen / (capacity * hours))

            generators_data.append(gen_info)

            # Aggregate by carrier
            carrier = gen_info["carrier"]
            if carrier not in by_carrier:
                by_carrier[carrier] = {
                    "total_capacity": 0,
                    "total_generation": 0,
                    "num_generators": 0,
                    "avg_capacity_factor": []
                }

            by_carrier[carrier]["total_capacity"] += gen_info.get("p_nom_opt", 0) or 0
            by_carrier[carrier]["total_generation"] += gen_info.get("total_generation", 0) or 0
            by_carrier[carrier]["num_generators"] += 1
            if gen_info.get("capacity_factor"):
                by_carrier[carrier]["avg_capacity_factor"].append(gen_info["capacity_factor"])

        # Calculate average capacity factors
        for carrier in by_carrier:
            cf_list = by_carrier[carrier]["avg_capacity_factor"]
            by_carrier[carrier]["avg_capacity_factor"] = safe_float(sum(cf_list) / len(cf_list)) if cf_list else 0

        return {
            "success": True,
            "generators": generators_data,
            "by_carrier": by_carrier
        }

    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Error getting generators: {error}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(error))


# =============================================================================
# LOADS
# =============================================================================

@router.get("/pypsa/loads")
async def get_loads(
    projectPath: str = Query(...),
    scenarioName: str = Query(...),
    networkFile: str = Query(...)
):
    """Get load information."""
    try:
        network_path = Path(projectPath) / "results" / "pypsa_optimization" / scenarioName / networkFile

        if not network_path.exists():
            raise HTTPException(status_code=404, detail=f"Network file not found: {networkFile}")

        network = load_network_cached(str(network_path))

        if not hasattr(network, 'loads') or network.loads.empty:
            return {"success": True, "loads": []}

        loads_data = []

        for idx, load in network.loads.iterrows():
            load_info = {
                "load_name": idx,
                "bus": str(load.get('bus', '')),
                "carrier": str(load.get('carrier', 'AC'))
            }

            # Get load profile if available
            if hasattr(network, 'loads_t') and hasattr(network.loads_t, 'p'):
                if idx in network.loads_t.p.columns:
                    load_series = network.loads_t.p[idx]
                    load_info["total_demand"] = safe_float(load_series.sum())
                    load_info["peak_demand"] = safe_float(load_series.max())
                    load_info["avg_demand"] = safe_float(load_series.mean())

            loads_data.append(load_info)

        return {
            "success": True,
            "loads": loads_data
        }

    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Error getting loads: {error}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(error))


# Placeholder routes for remaining components
# (Add full implementations as needed)

@router.get("/pypsa/storage-units")
async def get_storage_units(
    projectPath: str = Query(...),
    scenarioName: str = Query(...),
    networkFile: str = Query(...)
):
    """Get storage units (PHS, CAES - MW-based)."""
    return {"success": True, "message": "Implementation in progress", "storage_units": []}


@router.get("/pypsa/stores")
async def get_stores(
    projectPath: str = Query(...),
    scenarioName: str = Query(...),
    networkFile: str = Query(...)
):
    """Get stores (Batteries, H2 - MWh-based)."""
    return {"success": True, "message": "Implementation in progress", "stores": []}


@router.get("/pypsa/lines")
async def get_lines(
    projectPath: str = Query(...),
    scenarioName: str = Query(...),
    networkFile: str = Query(...)
):
    """Get AC transmission lines."""
    return {"success": True, "message": "Implementation in progress", "lines": []}


@router.get("/pypsa/links")
async def get_links(
    projectPath: str = Query(...),
    scenarioName: str = Query(...),
    networkFile: str = Query(...)
):
    """Get DC links and sector coupling."""
    return {"success": True, "message": "Implementation in progress", "links": []}


@router.get("/pypsa/transformers")
async def get_transformers(
    projectPath: str = Query(...),
    scenarioName: str = Query(...),
    networkFile: str = Query(...)
):
    """Get transformers."""
    return {"success": True, "message": "Implementation in progress", "transformers": []}


@router.get("/pypsa/global-constraints")
async def get_global_constraints(
    projectPath: str = Query(...),
    scenarioName: str = Query(...),
    networkFile: str = Query(...)
):
    """Get global constraints (CO2 limits, etc.)."""
    return {"success": True, "message": "Implementation in progress", "global_constraints": []}
