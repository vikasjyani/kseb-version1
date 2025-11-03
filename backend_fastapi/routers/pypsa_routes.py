"""
PyPSA Optimization Routes
=========================

Handles PyPSA grid optimization results visualization.

Endpoints:
- GET /project/optimization-folders - List pypsa_optimization subfolders
- GET /project/optimization-sheets - Get sheet names from Pypsa_results.xlsx
- GET /project/optimization-sheet-data - Get data from a specific sheet
"""

from fastapi import APIRouter, HTTPException, Query
from pathlib import Path
import openpyxl
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/optimization-folders")
async def get_optimization_folders(projectPath: str = Query(..., description="Project root path")):
    """
    List all subfolders in the pypsa_optimization directory.

    Args:
        projectPath: Project root directory

    Returns:
        dict: List of folder names
    """
    if not projectPath:
        raise HTTPException(status_code=400, detail="Project path is required.")

    optimization_folder_path = Path(projectPath) / "results" / "pypsa_optimization"

    if not optimization_folder_path.exists():
        logger.warning(f"Directory not found: {optimization_folder_path}")
        return {"success": True, "folders": []}

    try:
        folders = [
            item.name for item in optimization_folder_path.iterdir()
            if item.is_dir()
        ]
        return {"success": True, "folders": folders}

    except Exception as error:
        logger.error(f"❌ Error reading optimization folders: {error}")
        raise HTTPException(
            status_code=500,
            detail="Failed to read optimization folders."
        )


@router.get("/optimization-sheets")
async def get_optimization_sheets(
    projectPath: str = Query(..., description="Project root path"),
    folderName: str = Query(..., description="Optimization folder name")
):
    """
    Get all sheet names from Pypsa_results.xlsx in a specific folder.

    Args:
        projectPath: Project root directory
        folderName: Name of the optimization folder

    Returns:
        dict: List of sheet names
    """
    if not projectPath or not folderName:
        raise HTTPException(
            status_code=400,
            detail="Project path and folder name are required."
        )

    excel_file_path = (
        Path(projectPath) / "results" / "pypsa_optimization" / folderName / "Pypsa_results.xlsx"
    )

    if not excel_file_path.exists():
        raise HTTPException(
            status_code=404,
            detail="Pypsa_results.xlsx not found in the selected folder."
        )

    try:
        workbook = openpyxl.load_workbook(excel_file_path, read_only=True)
        sheet_names = workbook.sheetnames
        workbook.close()

        return {"success": True, "sheets": sheet_names}

    except Exception as error:
        logger.error(f"❌ Error reading Excel file sheet names: {error}")
        raise HTTPException(
            status_code=500,
            detail="Failed to read the Excel file."
        )


@router.get("/optimization-sheet-data")
async def get_optimization_sheet_data(
    projectPath: str = Query(..., description="Project root path"),
    folderName: str = Query(..., description="Optimization folder name"),
    sheetName: str = Query(..., description="Sheet name to read")
):
    """
    Get data from a specific sheet in Pypsa_results.xlsx.

    Args:
        projectPath: Project root directory
        folderName: Name of the optimization folder
        sheetName: Name of the sheet to read

    Returns:
        dict: Sheet data as JSON array
    """
    if not projectPath or not folderName or not sheetName:
        raise HTTPException(
            status_code=400,
            detail="Project path, folder name, and sheet name are required."
        )

    excel_file_path = (
        Path(projectPath) / "results" / "pypsa_optimization" / folderName / "Pypsa_results.xlsx"
    )

    if not excel_file_path.exists():
        raise HTTPException(
            status_code=404,
            detail="Pypsa_results.xlsx not found."
        )

    try:
        workbook = openpyxl.load_workbook(excel_file_path, read_only=True, data_only=True)

        if sheetName not in workbook.sheetnames:
            workbook.close()
            raise HTTPException(
                status_code=404,
                detail="Sheet not found in the Excel file."
            )

        worksheet = workbook[sheetName]

        # Read data
        headers = [cell.value for cell in next(worksheet.iter_rows(min_row=1, max_row=1))]
        json_data = []
        for row in worksheet.iter_rows(min_row=2, values_only=True):
            row_dict = dict(zip(headers, row))
            json_data.append(row_dict)

        workbook.close()

        return {"success": True, "data": json_data}

    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"❌ Error getting sheet data: {error}")
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve data from the sheet."
        )
