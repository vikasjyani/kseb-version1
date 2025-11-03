"""
Project Management Routes
=========================

Handles project creation, loading, validation, and directory operations.

Endpoints:
- POST /project/create - Create new project with folder structure
- POST /project/load - Load existing project
- GET /project/check-directory - Validate directory path
- GET /project/load-profiles - List all load profile files
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, List
import os
import shutil
from pathlib import Path
from datetime import datetime
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

# Path to Excel templates
SOURCE_INPUT_DIR = Path(__file__).parent.parent / "input"


class CreateProjectRequest(BaseModel):
    """Request model for creating a new project"""
    name: str = Field(..., description="Project name")
    location: str = Field(..., description="Parent directory path")
    description: Optional[str] = Field(None, description="Project description")


class LoadProjectRequest(BaseModel):
    """Request model for loading an existing project"""
    project_path: str = Field(..., description="Path to project directory")


class ProjectResponse(BaseModel):
    """Response model for project operations"""
    id: str
    name: str
    path: str
    lastOpened: str


def find_project_root(start_path: str, max_depth: int = 5) -> Optional[str]:
    """
    Find project root by looking for 'inputs' and 'results' folders.

    Args:
        start_path: Starting directory path
        max_depth: Maximum depth to search upwards

    Returns:
        Project root path if found, None otherwise
    """
    current_path = Path(start_path).resolve()

    for _ in range(max_depth):
        inputs_exist = (current_path / "inputs").exists()
        results_exist = (current_path / "results").exists()

        if inputs_exist and results_exist:
            return str(current_path)

        parent_path = current_path.parent
        if parent_path == current_path:  # Reached filesystem root
            return None

        current_path = parent_path

    return None


@router.post("/create", status_code=201)
async def create_project(request: CreateProjectRequest):
    """
    Create a new project with folder structure and template files.

    Creates:
    - Project root directory
    - inputs/ folder with Excel templates
    - results/ folder with subfolders:
        - demand_forecasts/
        - load_profiles/
        - pypsa_optimization/

    Args:
        request: Project creation parameters

    Returns:
        dict: Success status, message, and project path

    Raises:
        HTTPException: 400 if validation fails, 409 if project exists, 500 on error
    """
    name = request.name
    location = request.location

    if not name or not location:
        raise HTTPException(
            status_code=400,
            detail="Project name and location are required."
        )

    # Validate parent directory exists and is a directory
    try:
        location_path = Path(location)
        if not location_path.exists():
            raise HTTPException(
                status_code=400,
                detail="The specified parent folder path does not exist. Please check the path and try again."
            )
        if not location_path.is_dir():
            raise HTTPException(
                status_code=400,
                detail="The provided parent folder path is not a directory. Please select a valid folder."
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error checking parent location stats: {e}")
        raise HTTPException(
            status_code=500,
            detail="An error occurred while verifying the path."
        )

    project_path = location_path / name

    # Check if project already exists
    if project_path.exists():
        raise HTTPException(
            status_code=409,
            detail=f"A project named '{name}' already exists in this location. "
                   f"Please choose a different name or load the existing project."
        )

    inputs_path = project_path / "inputs"
    results_path = project_path / "results"

    try:
        # Create directory structure
        project_path.mkdir(parents=True, exist_ok=True)
        inputs_path.mkdir(exist_ok=True)
        results_path.mkdir(exist_ok=True)

        # Copy Excel template files from source directory
        if SOURCE_INPUT_DIR.exists():
            for file in SOURCE_INPUT_DIR.glob("*.xlsx"):
                dest_file = inputs_path / file.name
                shutil.copy2(file, dest_file)
                logger.info(f"Copied template: {file.name}")

        # Create result subfolders
        result_subfolders = ["demand_forecasts", "load_profiles", "pypsa_optimization"]
        for subfolder in result_subfolders:
            (results_path / subfolder).mkdir(exist_ok=True)

        logger.info(f"✅ Project created successfully: {project_path}")

        return {
            "success": True,
            "message": "✅ Project created with templates and folders.",
            "path": str(project_path)
        }

    except Exception as err:
        logger.error(f"❌ Error during project creation: {err}")
        # Cleanup on failure
        if project_path.exists():
            shutil.rmtree(project_path, ignore_errors=True)
        raise HTTPException(
            status_code=500,
            detail="❌ Internal server error during project creation."
        )


@router.post("/load")
async def load_project(request: LoadProjectRequest):
    """
    Validate and load an existing project.

    Searches for project root by looking for 'inputs' and 'results' folders.

    Args:
        request: Project path to load

    Returns:
        dict: Success status, message, and project details

    Raises:
        HTTPException: 400 if path invalid, 404 if not a valid project, 500 on error
    """
    project_path = request.project_path

    if not project_path or not project_path.strip():
        raise HTTPException(
            status_code=400,
            detail="Project path is required."
        )

    try:
        root_path = find_project_root(project_path)

        if root_path:
            project_name = Path(root_path).name
            project = {
                "id": f"proj_{int(datetime.now().timestamp() * 1000)}",
                "name": project_name,
                "path": root_path,
                "lastOpened": datetime.now().isoformat()
            }
            return {
                "success": True,
                "message": "Project loaded successfully.",
                "project": project
            }
        else:
            raise HTTPException(
                status_code=404,
                detail="The specified folder is not a valid project workspace."
            )

    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"❌ Error during project load: {error}")
        raise HTTPException(
            status_code=500,
            detail="An internal server error occurred while loading the project."
        )


@router.get("/check-directory")
async def check_directory(path: str = Query(..., description="Directory path to validate")):
    """
    Validate if a given path is a valid directory.

    Used by frontend for real-time path validation.

    Args:
        path: Directory path to check

    Returns:
        dict: Validation result with isValid flag and message

    Raises:
        HTTPException: 400/404/500 on validation errors
    """
    if not path:
        raise HTTPException(
            status_code=400,
            detail="No path provided."
        )

    try:
        from urllib.parse import unquote
        decoded_path = unquote(path)
        path_obj = Path(decoded_path)

        if not path_obj.exists():
            raise HTTPException(
                status_code=404,
                detail="Folder path not found."
            )

        if not path_obj.is_dir():
            raise HTTPException(
                status_code=400,
                detail="The selected path points to a file, not a folder."
            )

        return {
            "isValid": True,
            "message": "Path is a valid directory."
        }

    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Error verifying directory: {error}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error."
        )


@router.get("/load-profiles")
async def get_load_profiles(projectPath: str = Query(..., description="Project root path")):
    """
    List all load profile Excel files in the project.

    Args:
        projectPath: Project root directory

    Returns:
        dict: Success status and list of profile names (without .xlsx extension)

    Raises:
        HTTPException: 400 if path missing, 500 on error
    """
    if not projectPath:
        raise HTTPException(
            status_code=400,
            detail="Project path is required."
        )

    try:
        profiles_dir = Path(projectPath) / "results" / "load_profiles"

        if not profiles_dir.exists():
            logger.info(f"Directory not found, returning empty list: {profiles_dir}")
            return {"success": True, "profiles": []}

        # Get all .xlsx files
        excel_files = [
            file.stem for file in profiles_dir.glob("*.xlsx")
        ]

        return {
            "success": True,
            "profiles": sorted(excel_files)
        }

    except Exception as error:
        logger.error(f"❌ Error reading load profiles directory: {error}")
        raise HTTPException(
            status_code=500,
            detail="An error occurred while fetching load profiles."
        )
