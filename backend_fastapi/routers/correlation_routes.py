"""
Correlation Analysis Routes
===========================

Calculates Pearson correlation coefficients between variables.

Endpoints:
- POST /project/correlation-matrix - Calculate correlation matrix for all numeric variables
- POST /project/correlation - Correlate all variables against Electricity
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Dict, Any
import math
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


class CorrelationRequest(BaseModel):
    """Request model for correlation analysis"""
    data: List[Dict[str, Any]] = Field(..., description="Array of data objects with numeric values")


def calculate_correlation(x_vals: List[float], y_vals: List[float]) -> float:
    """
    Calculate Pearson correlation coefficient.

    Args:
        x_vals: X variable values
        y_vals: Y variable values

    Returns:
        Correlation coefficient (rounded to 4 decimals)
    """
    n = len(x_vals)
    if n != len(y_vals) or n == 0:
        return 0.0

    sum_x = sum(x_vals)
    sum_y = sum(y_vals)
    sum_xy = sum(x * y for x, y in zip(x_vals, y_vals))
    sum_x2 = sum(x * x for x in x_vals)
    sum_y2 = sum(y * y for y in y_vals)

    numerator = n * sum_xy - sum_x * sum_y
    denominator = math.sqrt((n * sum_x2 - sum_x * sum_x) * (n * sum_y2 - sum_y * sum_y))

    if denominator == 0:
        return 0.0

    return round(numerator / denominator, 4)


def is_numeric_column(data: List[Dict[str, Any]], key: str) -> bool:
    """
    Check if a column contains numeric values.

    Args:
        data: Data array
        key: Column key to check

    Returns:
        True if column is numeric, False otherwise
    """
    for row in data:
        value = row.get(key)
        if value is None:
            continue
        try:
            float(value)
        except (ValueError, TypeError):
            return False
    return True


@router.post("/correlation-matrix")
async def correlation_matrix(request: CorrelationRequest):
    """
    Calculate correlation matrix for all numeric variables.

    Computes pairwise correlations between all numeric columns in the dataset.

    Args:
        request: Data array

    Returns:
        dict: Correlation matrix and list of variables

    Raises:
        HTTPException: 400 on invalid data
    """
    data = request.data

    if not data or len(data) == 0:
        raise HTTPException(
            status_code=400,
            detail="Invalid or empty data"
        )

    # Identify numeric columns
    numeric_keys = [
        key for key in data[0].keys()
        if is_numeric_column(data, key)
    ]

    if len(numeric_keys) == 0:
        return {"matrix": [], "variables": []}

    # Build correlation matrix
    correlation_matrix_data = {}

    for var1 in numeric_keys:
        correlation_matrix_data[var1] = {}
        for var2 in numeric_keys:
            # Extract paired values (exclude nulls)
            paired_data = {
                'xVals': [],
                'yVals': []
            }

            for row in data:
                x = row.get(var1)
                y = row.get(var2)
                if x is not None and y is not None:
                    try:
                        paired_data['xVals'].append(float(x))
                        paired_data['yVals'].append(float(y))
                    except (ValueError, TypeError):
                        continue

            # Calculate correlation
            corr = calculate_correlation(paired_data['xVals'], paired_data['yVals'])
            correlation_matrix_data[var1][var2] = corr

    # Format matrix as array of objects
    formatted_matrix = [
        {
            "variable": variable,
            "correlations": correlation_matrix_data[variable]
        }
        for variable in numeric_keys
    ]

    return {
        "matrix": formatted_matrix,
        "variables": numeric_keys
    }


def get_strength(value: float) -> str:
    """
    Classify correlation strength.

    Args:
        value: Correlation coefficient

    Returns:
        Strength classification string
    """
    abs_val = abs(value)
    if abs_val >= 0.75:
        return "Very Strong"
    elif abs_val >= 0.5:
        return "Strong"
    else:
        return "Poor"


@router.post("/correlation")
async def correlation(request: CorrelationRequest):
    """
    Calculate correlation of all numeric variables against 'Electricity'.

    Args:
        request: Data array

    Returns:
        dict: List of correlations with strength classification

    Raises:
        HTTPException: 400 on invalid data
    """
    data = request.data

    if not data or len(data) == 0:
        raise HTTPException(
            status_code=400,
            detail="Invalid or empty data"
        )

    # Identify numeric columns
    numeric_keys = [
        key for key in data[0].keys()
        if is_numeric_column(data, key)
    ]

    if 'Electricity' not in numeric_keys:
        return {"correlations": []}

    # Calculate correlations against Electricity
    result = []
    for key in numeric_keys:
        if key == 'Electricity':
            continue

        # Extract paired values
        paired_data = {
            'xVals': [],
            'yVals': []
        }

        for row in data:
            x = row.get(key)
            y = row.get('Electricity')
            if x is not None and y is not None:
                try:
                    paired_data['xVals'].append(float(x))
                    paired_data['yVals'].append(float(y))
                except (ValueError, TypeError):
                    continue

        corr = calculate_correlation(paired_data['xVals'], paired_data['yVals'])

        result.append({
            "variable": key,
            "correlation": corr,
            "strength": get_strength(corr)
        })

    return {"correlations": result}
