"""
Settings Routes
===============

Handles color configuration for visualization.

Endpoints:
- GET /project/settings/colors - Fetch color configuration
- POST /project/settings/save-colors - Save color configuration
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from pathlib import Path
from typing import Dict, Any
import json
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


class SaveColorsRequest(BaseModel):
    """Request model for saving color configuration"""
    projectPath: str = Field(..., description="Project root path")
    colorConfig: Dict[str, Any] = Field(..., description="Color configuration object")


@router.get("/settings/colors")
async def get_colors(projectPath: str = Query(..., description="Project root path")):
    """
    Fetch color configuration from color.json file.

    Args:
        projectPath: Project root directory

    Returns:
        dict: Color configuration object
    """
    if not projectPath:
        raise HTTPException(status_code=400, detail="Project path is required.")

    color_file_path = Path(projectPath) / "color.json"

    try:
        if color_file_path.exists():
            with open(color_file_path, 'r', encoding='utf-8') as f:
                color_config = json.load(f)
            return color_config
        else:
            raise HTTPException(
                status_code=404,
                detail="Color configuration not found."
            )

    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Error reading color config: {error}")
        raise HTTPException(
            status_code=500,
            detail="Failed to read color configuration."
        )


@router.post("/settings/save-colors")
async def save_colors(request: SaveColorsRequest):
    """
    Save color configuration to color.json file.

    Args:
        request: Color configuration data

    Returns:
        dict: Success message
    """
    if not request.projectPath or not request.colorConfig:
        raise HTTPException(
            status_code=400,
            detail="Project path and color configuration are required."
        )

    color_file_path = Path(request.projectPath) / "color.json"

    try:
        with open(color_file_path, 'w', encoding='utf-8') as f:
            json.dump(request.colorConfig, f, indent=2)

        return {
            "success": True,
            "message": "Color configuration saved successfully."
        }

    except Exception as error:
        logger.error(f"Error saving color config: {error}")
        raise HTTPException(
            status_code=500,
            detail="Failed to save color configuration."
        )
