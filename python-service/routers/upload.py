"""Video upload and listing endpoints."""
import os
import shutil
import uuid
from typing import List

import aiofiles
import cv2
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from db import database as db

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, "../../data/uploads")
ALLOWED_EXTENSIONS = {".mp4", ".avi", ".mov", ".mkv"}
MAX_FILE_SIZE = 500 * 1024 * 1024  # 500 MB

router = APIRouter()


def _extract_metadata(path: str) -> dict:
    """Extract video metadata using OpenCV."""
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        return {}
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = cap.get(cv2.CAP_PROP_FRAME_COUNT)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    duration = total_frames / fps if fps > 0 else 0
    cap.release()
    return {
        "fps": round(fps, 2),
        "duration_seconds": round(duration, 2),
        "width": width,
        "height": height,
    }


@router.post("/upload")
async def upload_video(file: UploadFile = File(...)):
    """Upload a video file. Returns video record with metadata."""
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"Unsupported format: {ext}. Use MP4, AVI, MOV, or MKV.")

    unique_name = f"{uuid.uuid4().hex}{ext}"
    dest_path = os.path.join(UPLOAD_DIR, unique_name)

    # stream to disk
    size = 0
    async with aiofiles.open(dest_path, "wb") as f:
        while chunk := await file.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_FILE_SIZE:
                await f.close()
                os.remove(dest_path)
                raise HTTPException(413, "File exceeds 500 MB limit.")
            await f.write(chunk)

    meta = _extract_metadata(dest_path)
    video_id = await db.insert_video(
        {
            "filename": unique_name,
            "original_name": file.filename,
            "file_size": size,
            "status": "ready",
            **meta,
        }
    )

    video = await db.get_video(video_id)
    return JSONResponse(status_code=201, content={"video": video})


@router.get("/videos")
async def list_videos():
    """Return all uploaded videos."""
    videos = await db.list_videos()
    return {"videos": videos}


@router.get("/videos/{video_id}")
async def get_video(video_id: int):
    """Return a single video record."""
    video = await db.get_video(video_id)
    if not video:
        raise HTTPException(404, "Video not found")
    runs = await db.list_runs_for_video(video_id)
    return {"video": video, "runs": runs}


@router.delete("/videos/{video_id}")
async def delete_video(video_id: int):
    """Delete a video and its uploads file."""
    video = await db.get_video(video_id)
    if not video:
        raise HTTPException(404, "Video not found")
    path = os.path.join(UPLOAD_DIR, video["filename"])
    if os.path.exists(path):
        os.remove(path)
    await db.update_video_status(video_id, "deleted")
    return {"message": "Deleted"}
