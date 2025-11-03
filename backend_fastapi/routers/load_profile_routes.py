"""
Load Profile File Routes
========================

Handles listing of load profile files.

Endpoints:
- GET /project/load-profiles - List all .xlsx profile files
"""

from fastapi import APIRouter, HTTPException, Query
from pathlib import Path
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/load-profiles")
async def list_load_profiles(projectPath: str = Query(..., description="Project root path")):
    """
    List all load profile Excel files in the project.

    Args:
        projectPath: Project root directory

    Returns:
        dict: Success status and list of profile names (without .xlsx extension)
    """
    if not projectPath:
        raise HTTPException(status_code=400, detail="Project path is required.")

    try:
        profiles_dir = Path(projectPath) / "results" / "load_profiles"

        # Check if directory exists
        if not profiles_dir.exists():
            logger.info(f"Directory not found, returning empty list: {profiles_dir}")
            return {"success": True, "profiles": []}

        # Get all .xlsx files
        excel_files = [
            file.stem for file in profiles_dir.glob("*.xlsx")
        ]

        return {"success": True, "profiles": sorted(excel_files)}

    except Exception as error:
        logger.error(f"❌ Error reading load profiles directory: {error}")
        raise HTTPException(
            status_code=500,
            detail="An error occurred while fetching load profiles."
        )
