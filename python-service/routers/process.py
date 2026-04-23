"""Processing endpoints + WebSocket streaming."""
from __future__ import annotations

import asyncio
import csv
import json
import os
import queue
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, StreamingResponse

from core.pipeline import MotionPipeline
from db import database as db
from models.schemas import ProcessingConfig

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "../../data")
OUTPUT_DIR = os.path.join(DATA_DIR, "outputs")
UPLOAD_DIR = os.path.join(DATA_DIR, "uploads")

router = APIRouter()

# Global executor and run-state registry
_executor = ThreadPoolExecutor(max_workers=2)

# run_id → { queue, cancel_event, summary }
_active: Dict[int, Dict[str, Any]] = {}


# ---------------------------------------------------------------------------
# Start processing
# ---------------------------------------------------------------------------

@router.post("/process")
async def start_processing(body: dict):
    """
    Start processing a video.

    Body: { video_id: int, config?: ProcessingConfig }
    Returns: { run_id: int }
    """
    video_id: int = body.get("video_id")  # type: ignore[assignment]
    cfg_data: dict = body.get("config", {})

    if not video_id:
        raise HTTPException(400, "video_id required")

    video = await db.get_video(video_id)
    if not video:
        raise HTTPException(404, "Video not found")

    cfg = ProcessingConfig.model_validate(cfg_data) if cfg_data else ProcessingConfig()
    run_id = await db.insert_run(video_id, cfg.model_dump())

    video_path = os.path.join(UPLOAD_DIR, video["filename"])

    q: queue.Queue = queue.Queue()
    cancel = threading.Event()

    state: Dict[str, Any] = {
        "queue": q,
        "cancel": cancel,
        "summary": None,
        "status": "processing",
    }
    _active[run_id] = state

    await db.update_run(run_id, {"status": "processing"})

    # Run in thread pool so it doesn't block the event loop
    loop = asyncio.get_event_loop()
    pipeline = MotionPipeline(cfg, run_id)

    def _run():
        summary = pipeline.run(video_path, q, cancel)
        state["summary"] = summary

    loop.run_in_executor(_executor, _run)

    return {"run_id": run_id, "status": "started"}


# ---------------------------------------------------------------------------
# Cancel processing
# ---------------------------------------------------------------------------

@router.delete("/process/{run_id}")
async def cancel_processing(run_id: int):
    state = _active.get(run_id)
    if state:
        state["cancel"].set()
    await db.update_run(run_id, {"status": "cancelled"})
    return {"message": "Cancelled"}


# ---------------------------------------------------------------------------
# Status polling (REST fallback)
# ---------------------------------------------------------------------------

@router.get("/process/{run_id}/status")
async def get_status(run_id: int):
    run = await db.get_run(run_id)
    if not run:
        raise HTTPException(404, "Run not found")
    state = _active.get(run_id)
    return {
        "run_id": run_id,
        "status": run["status"],
        "processed_frames": run["processed_frames"],
        "total_frames": run["total_frames"],
        "progress": (
            round(run["processed_frames"] / max(run["total_frames"], 1) * 100, 1)
            if run["total_frames"]
            else 0
        ),
    }


# ---------------------------------------------------------------------------
# Results
# ---------------------------------------------------------------------------

@router.get("/results/{run_id}")
async def get_results(run_id: int):
    run = await db.get_run(run_id)
    if not run:
        raise HTTPException(404, "Run not found")
    events = await db.get_events(run_id)
    speed_vals = [e["speed_kmph"] for e in events if e["speed_kmph"] is not None]
    vtype_counts: Dict[str, int] = {}
    violations = 0
    for e in events:
        vt = e.get("vehicle_type", "unknown")
        vtype_counts[vt] = vtype_counts.get(vt, 0) + 1
        if e.get("is_violation"):
            violations += 1
    return {
        "run_id": run_id,
        "status": run["status"],
        "total_events": len(events),
        "total_violations": violations,
        "avg_speed": round(sum(speed_vals) / max(len(speed_vals), 1), 1),
        "max_speed": max(speed_vals, default=0.0),
        "vehicle_type_counts": vtype_counts,
        "events": events,
    }


# ---------------------------------------------------------------------------
# Download endpoints
# ---------------------------------------------------------------------------

@router.get("/runs/{run_id}/download/video")
async def download_video(run_id: int):
    out_path = os.path.join(OUTPUT_DIR, f"{run_id}_annotated.mp4")
    if not os.path.exists(out_path):
        raise HTTPException(404, "Annotated video not yet available")
    return FileResponse(
        out_path,
        media_type="video/mp4",
        filename=f"annotated_run_{run_id}.mp4",
        headers={"Content-Disposition": f'attachment; filename="annotated_run_{run_id}.mp4"'},
    )


@router.get("/runs/{run_id}/download/csv")
async def download_csv(run_id: int):
    events = await db.get_events(run_id)
    if not events:
        raise HTTPException(404, "No events for this run")

    fields = [
        "id", "frame_number", "timestamp_seconds", "track_id", "vehicle_type",
        "vehicle_confidence", "speed_kmph", "is_violation",
        "bbox_x", "bbox_y", "bbox_width", "bbox_height", "thumbnail_path",
    ]

    def _generate():
        import io
        buf = io.StringIO()
        writer = csv.DictWriter(buf, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        for e in events:
            writer.writerow(e)
        yield buf.getvalue().encode("utf-8")

    return StreamingResponse(
        _generate(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="events_run_{run_id}.csv"'},
    )


@router.get("/runs/{run_id}/download/json")
async def download_json(run_id: int):
    events = await db.get_events(run_id)
    data = json.dumps(events, indent=2).encode("utf-8")
    return StreamingResponse(
        iter([data]),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="events_run_{run_id}.json"'},
    )


# ---------------------------------------------------------------------------
# WebSocket — real-time streaming
# ---------------------------------------------------------------------------

@router.websocket("/ws/{run_id}")
async def websocket_stream(websocket: WebSocket, run_id: int):
    """
    Streams frame_processed and event_detected messages from the processing queue.
    Persists events to DB on the fly.
    """
    await websocket.accept()

    state = _active.get(run_id)
    if not state:
        await websocket.send_json({"type": "error", "message": "Run not found or not active"})
        await websocket.close()
        return

    loop = asyncio.get_event_loop()
    q: queue.Queue = state["queue"]
    has_started = False

    # Wait up to 3 s for the processing thread to actually start
    for _ in range(30):
        if not q.empty():
            has_started = True
            break
        await asyncio.sleep(0.1)

    try:
        while True:
            # Fetch from thread-safe queue in executor (non-blocking on event loop)
            try:
                msg = await asyncio.wait_for(
                    loop.run_in_executor(None, _queue_get, q),
                    timeout=60.0,
                )
            except asyncio.TimeoutError:
                # Send a ping to keep connection alive
                await websocket.send_json({"type": "ping"})
                continue

            # Queue was empty during this 1-second window — keep waiting
            if msg is _SENTINEL_RETRY:
                continue

            if msg is None:
                # Sentinel — processing complete
                run = await db.get_run(run_id)
                if run:
                    summary = state.get("summary", {}) or {}
                    await db.update_run(
                        run_id,
                        {
                            "status": "completed",
                            "processed_frames": summary.get("processedFrames", 0),
                            "total_frames": summary.get("totalFrames", 0),
                            "output_video_path": summary.get("outputVideoPath"),
                        },
                    )
                    # Persist events to DB
                    for ev in summary.get("events", []):
                        await db.insert_event(run_id, {
                            "frame_number": ev.get("frameNumber"),
                            "timestamp_seconds": ev.get("timestampSeconds"),
                            "track_id": ev.get("trackId"),
                            "vehicle_type": ev.get("vehicleType"),
                            "vehicle_confidence": ev.get("vehicleConfidence", 0.85),
                            "speed_kmph": ev.get("speedKmph"),
                            "is_violation": ev.get("isViolation", False),
                            "bbox_x": ev.get("bboxX"),
                            "bbox_y": ev.get("bboxY"),
                            "bbox_width": ev.get("bboxWidth"),
                            "bbox_height": ev.get("bboxHeight"),
                            "thumbnail_path": ev.get("thumbnailPath"),
                        })
                await websocket.send_json({"type": "processing_complete", "runId": run_id})
                break

            # Forward message to client
            try:
                await websocket.send_json(msg)
            except Exception:
                break

    except WebSocketDisconnect:
        pass
    finally:
        _active.pop(run_id, None)


def _queue_get(q: queue.Queue) -> Any:
    """Blocking get with 1-second timeout (to allow executor thread to be re-used)."""
    try:
        return q.get(timeout=1.0)
    except queue.Empty:
        return _SENTINEL_RETRY


# Sentinel to signal "nothing yet, keep waiting"
_SENTINEL_RETRY = object()
