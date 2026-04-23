"""SQLite database initialization and CRUD helpers."""
import aiosqlite
import os
import json
from typing import Optional, Dict, Any, List

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "../../data/db/vehicles.db")

_CREATE_TABLES = """
CREATE TABLE IF NOT EXISTS videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    duration_seconds REAL,
    fps REAL,
    width INTEGER,
    height INTEGER,
    file_size INTEGER,
    status TEXT DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS processing_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id INTEGER NOT NULL,
    config_json TEXT,
    start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    end_time DATETIME,
    total_frames INTEGER DEFAULT 0,
    processed_frames INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    output_video_path TEXT,
    output_csv_path TEXT,
    FOREIGN KEY (video_id) REFERENCES videos(id)
);

CREATE TABLE IF NOT EXISTS vehicle_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL,
    frame_number INTEGER,
    timestamp_seconds REAL,
    track_id INTEGER,
    vehicle_type TEXT,
    vehicle_confidence REAL DEFAULT 0.85,
    speed_kmph REAL,
    is_violation INTEGER DEFAULT 0,
    bbox_x INTEGER,
    bbox_y INTEGER,
    bbox_width INTEGER,
    bbox_height INTEGER,
    thumbnail_path TEXT,
    FOREIGN KEY (run_id) REFERENCES processing_runs(id)
);

CREATE TABLE IF NOT EXISTS tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL,
    track_id INTEGER,
    first_frame INTEGER,
    last_frame INTEGER,
    vehicle_type TEXT,
    avg_speed REAL,
    max_speed REAL,
    trajectory_json TEXT,
    FOREIGN KEY (run_id) REFERENCES processing_runs(id)
);
"""


async def init_db() -> None:
    """Initialize the SQLite database with schema."""
    db_dir = os.path.dirname(DB_PATH)
    os.makedirs(db_dir, exist_ok=True)
    async with aiosqlite.connect(DB_PATH) as db:
        await db.executescript(_CREATE_TABLES)
        await db.commit()


async def insert_video(data: Dict[str, Any]) -> int:
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            """INSERT INTO videos
               (filename, original_name, duration_seconds, fps, width, height, file_size, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                data["filename"], data["original_name"], data.get("duration_seconds"),
                data.get("fps"), data.get("width"), data.get("height"),
                data.get("file_size"), data.get("status", "pending"),
            ),
        )
        await db.commit()
        return cursor.lastrowid


async def get_video(video_id: int) -> Optional[Dict[str, Any]]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM videos WHERE id = ?", (video_id,)) as cur:
            row = await cur.fetchone()
            return dict(row) if row else None


async def list_videos() -> List[Dict[str, Any]]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM videos ORDER BY upload_date DESC") as cur:
            rows = await cur.fetchall()
            return [dict(r) for r in rows]


async def update_video_status(video_id: int, status: str) -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("UPDATE videos SET status = ? WHERE id = ?", (status, video_id))
        await db.commit()


async def insert_run(video_id: int, config: Dict[str, Any]) -> int:
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            "INSERT INTO processing_runs (video_id, config_json, status) VALUES (?, ?, ?)",
            (video_id, json.dumps(config), "pending"),
        )
        await db.commit()
        return cursor.lastrowid


async def update_run(run_id: int, data: Dict[str, Any]) -> None:
    fields = ", ".join(f"{k} = ?" for k in data)
    values = list(data.values()) + [run_id]
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(f"UPDATE processing_runs SET {fields} WHERE id = ?", values)
        await db.commit()


async def get_run(run_id: int) -> Optional[Dict[str, Any]]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM processing_runs WHERE id = ?", (run_id,)) as cur:
            row = await cur.fetchone()
            return dict(row) if row else None


async def list_runs_for_video(video_id: int) -> List[Dict[str, Any]]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM processing_runs WHERE video_id = ? ORDER BY id DESC", (video_id,)
        ) as cur:
            rows = await cur.fetchall()
            return [dict(r) for r in rows]


async def insert_event(run_id: int, event: Dict[str, Any]) -> int:
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            """INSERT INTO vehicle_events
               (run_id, frame_number, timestamp_seconds, track_id, vehicle_type,
                vehicle_confidence, speed_kmph, is_violation,
                bbox_x, bbox_y, bbox_width, bbox_height, thumbnail_path)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                run_id, event.get("frame_number"), event.get("timestamp_seconds"),
                event.get("track_id"), event.get("vehicle_type"),
                event.get("vehicle_confidence", 0.85), event.get("speed_kmph"),
                int(event.get("is_violation", False)),
                event.get("bbox_x"), event.get("bbox_y"),
                event.get("bbox_width"), event.get("bbox_height"),
                event.get("thumbnail_path"),
            ),
        )
        await db.commit()
        return cursor.lastrowid


async def get_events(run_id: int) -> List[Dict[str, Any]]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM vehicle_events WHERE run_id = ? ORDER BY frame_number ASC",
            (run_id,),
        ) as cur:
            rows = await cur.fetchall()
            return [dict(r) for r in rows]
