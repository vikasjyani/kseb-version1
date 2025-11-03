"""
Demand Forecasting Routes
=========================

Handles demand forecasting execution with real-time progress via SSE.

Endpoints:
- POST /project/forecast - Start forecasting process
- GET /project/forecast-progress - Server-Sent Events for progress updates
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from pathlib import Path
from typing import List, Dict, Any, Optional
import subprocess
import json
import asyncio
import logging
import threading
import queue

logger = logging.getLogger(__name__)
router = APIRouter()

# Global queue for SSE events
forecast_event_queue: asyncio.Queue = None


class SectorConfig(BaseModel):
    """Configuration for a single sector"""
    name: str
    selectedMethods: List[str]
    mlrParameters: List[str]
    wamWindow: int
    data: List[Dict[str, Any]]


class ForecastRequest(BaseModel):
    """Request model for forecast generation"""
    projectPath: str = Field(..., description="Project root path")
    scenarioName: str = Field(..., description="Scenario name")
    targetYear: int = Field(..., description="Target forecast year")
    excludeCovidYears: bool = Field(..., description="Exclude COVID-19 years flag")
    sectors: List[SectorConfig] = Field(..., description="List of sector configurations")


@router.get("/forecast-progress")
async def forecast_progress():
    """
    Server-Sent Events endpoint for real-time forecast progress.

    Streams progress events from the Python forecasting script to the frontend.

    Returns:
        StreamingResponse: SSE stream with progress events

    Event Types:
    - progress: Ongoing progress update
    - sector_completed: Sector forecast completed
    - end: Forecasting process completed/failed
    """
    global forecast_event_queue

    async def event_generator():
        """Generate SSE events from the queue"""
        try:
            # Initialize queue if not exists
            if forecast_event_queue is None:
                raise HTTPException(status_code=500, detail="Event queue not initialized")

            # Send keep-alive comments every 15 seconds
            while True:
                try:
                    # Wait for event with timeout
                    event = await asyncio.wait_for(
                        forecast_event_queue.get(),
                        timeout=15.0
                    )

                    # Send event
                    event_type = event.get('type', 'progress')
                    yield f"event: {event_type}\n"
                    yield f"data: {json.dumps(event)}\n\n"

                    # Check if this is the end event
                    if event_type == 'end':
                        break

                except asyncio.TimeoutError:
                    # Send keep-alive comment
                    yield ": keep-alive\n\n"

        except Exception as e:
            logger.error(f"SSE error: {e}")
            yield f"event: error\n"
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # Disable nginx buffering
        }
    )


@router.post("/forecast", status_code=202)
async def start_forecast(request: ForecastRequest):
    """
    Start the demand forecasting process.

    Spawns a Python subprocess to run forecasting.py with the provided configuration.
    Progress updates are sent via Server-Sent Events to /forecast-progress endpoint.

    Args:
        request: Forecast configuration

    Returns:
        dict: Success message (202 Accepted)

    Raises:
        HTTPException: 400 on invalid configuration
    """
    global forecast_event_queue

    if not request.projectPath or not request.scenarioName:
        raise HTTPException(
            status_code=400,
            detail="Invalid configuration received."
        )

    # Initialize event queue
    forecast_event_queue = asyncio.Queue()

    # Create scenario results directory
    scenario_results_path = (
        Path(request.projectPath) / "results" / "demand_forecasts" / request.scenarioName
    )
    scenario_results_path.mkdir(parents=True, exist_ok=True)

    # Prepare configuration for Python script
    config_for_python = {
        "scenario_name": request.scenarioName,
        "target_year": request.targetYear,
        "exclude_covid": request.excludeCovidYears,
        "forecast_path": str(scenario_results_path),
        "sectors": {}
    }

    for sector in request.sectors:
        config_for_python["sectors"][sector.name] = {
            "enabled": True,
            "models": sector.selectedMethods,
            "parameters": {
                "MLR": {"independent_vars": sector.mlrParameters},
                "WAM": {"window_size": sector.wamWindow}
            },
            "data": sector.data
        }

    # Write config to temporary file
    import time
    config_path = scenario_results_path / f"forecast_config.json"
    with open(config_path, 'w') as f:
        json.dump(config_for_python, f, indent=2)

    logger.info(f"Python script config saved to: {config_path}")

    # Start Python process in background
    asyncio.create_task(run_forecast_process(config_path, forecast_event_queue))

    return {
        "success": True,
        "message": "Forecast process started."
    }


async def run_forecast_process(config_path: Path, event_queue: asyncio.Queue):
    """
    Run the Python forecasting script as a subprocess using synchronous subprocess.

    Args:
        config_path: Path to configuration JSON file
        event_queue: Queue for sending SSE events
    """
    python_script_path = Path(__file__).parent.parent / "models" / "forecasting.py"
    logger.info(f"Starting forecast process with script: {python_script_path}")
    logger.info(f"Config path: {config_path}")

    def run_subprocess():
        """Run the subprocess in a separate thread"""
        try:
            # Check if script exists
            if not python_script_path.exists():
                asyncio.run(event_queue.put({
                    "status": "failed",
                    "error": f"Script not found: {python_script_path}",
                    "type": "end"
                }))
                return

            # Check if config exists
            if not config_path.exists():
                asyncio.run(event_queue.put({
                    "status": "failed",
                    "error": f"Config not found: {config_path}",
                    "type": "end"
                }))
                return

            logger.info("Starting subprocess execution...")

            # Start subprocess using synchronous subprocess
            process = subprocess.Popen(
                ["python", str(python_script_path), "--config", str(config_path)],
                cwd=str(python_script_path.parent),  # Set working directory
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,  # Use text mode for easier string handling
                bufsize=1   # Line buffered
            )

            logger.info(f"Subprocess started with PID: {process.pid}")

            # Read stdout and stderr in separate threads
            final_output = ""

            def read_stdout():
                nonlocal final_output
                try:
                    for line in iter(process.stdout.readline, ''):
                        line = line.strip()
                        if line:
                            logger.info(f"[Python STDOUT]: {line}")

                            # Parse progress lines
                            if line.startswith('PROGRESS:'):
                                try:
                                    progress_data = json.loads(line[9:])  # Remove 'PROGRESS:' prefix
                                    asyncio.run(event_queue.put(progress_data))
                                except json.JSONDecodeError as e:
                                    logger.error(f"Failed to parse progress JSON: {e}")
                            else:
                                # Capture final JSON output
                                final_output = line
                except Exception as e:
                    logger.error(f"Error reading stdout: {e}")

            def read_stderr():
                try:
                    for line in iter(process.stderr.readline, ''):
                        line = line.strip()
                        if line:
                            logger.error(f"[Python STDERR]: {line}")
                except Exception as e:
                    logger.error(f"Error reading stderr: {e}")

            # Start reading threads
            stdout_thread = threading.Thread(target=read_stdout, daemon=True)
            stderr_thread = threading.Thread(target=read_stderr, daemon=True)

            stdout_thread.start()
            stderr_thread.start()

            # Wait for process to complete
            process.wait()
            logger.info(f"Python process finished with code {process.returncode}")

            # Wait for reading threads to complete
            stdout_thread.join(timeout=5.0)
            stderr_thread.join(timeout=5.0)

            # Clean up
            process.stdout.close()
            process.stderr.close()

            # Clean up config file
            try:
                config_path.unlink()
                logger.info(f"Deleted temp config file: {config_path}")
            except Exception as e:
                logger.error(f"Failed to delete temp config file: {e}")

            # Send final result
            if process.returncode == 0:
                try:
                    # Parse the final JSON output from the script
                    if final_output:
                        final_data = json.loads(final_output)
                        final_result = {
                            "status": "completed",
                            "result": final_data,
                            "type": "end"
                        }
                    else:
                        final_result = {"status": "completed", "type": "end"}
                except json.JSONDecodeError as e:
                    logger.error(f"Failed to parse final JSON output: {e}")
                    final_result = {"status": "completed", "type": "end"}
            else:
                final_result = {
                    "status": "failed",
                    "error": f"Python script exited with error code {process.returncode}.",
                    "type": "end"
                }

            asyncio.run(event_queue.put(final_result))

        except Exception as e:
            logger.error(f"Error in subprocess thread: {e}")
            logger.error(f"Exception type: {type(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            asyncio.run(event_queue.put({
                "status": "failed",
                "error": f"Failed to start forecast process: {str(e)}",
                "type": "end"
            }))

    # Start the subprocess in a separate thread
    subprocess_thread = threading.Thread(target=run_subprocess, daemon=True)
    subprocess_thread.start()
