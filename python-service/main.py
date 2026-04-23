"""FastAPI application entry-point."""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from db.database import init_db
from routers.upload import router as upload_router
from routers.process import router as process_router

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "../data")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialise DB and directories on startup."""
    os.makedirs(os.path.join(DATA_DIR, "uploads"), exist_ok=True)
    os.makedirs(os.path.join(DATA_DIR, "outputs", "snapshots"), exist_ok=True)
    os.makedirs(os.path.join(DATA_DIR, "db"), exist_ok=True)
    await init_db()
    yield


app = FastAPI(
    title="Vehicle Detection API",
    version="1.0.0",
    description="Motion-based vehicle detection, tracking and speed estimation service.",
    lifespan=lifespan,
)

# ---- CORS (allow React dev server) ----
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- Routers ----
app.include_router(upload_router, prefix="/api", tags=["Upload"])
app.include_router(process_router, prefix="/api", tags=["Processing"])

# ---- Static file serving ----
outputs_dir = os.path.join(DATA_DIR, "outputs")
os.makedirs(outputs_dir, exist_ok=True)
app.mount("/outputs", StaticFiles(directory=outputs_dir), name="outputs")


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok", "service": "vehicle-detection-api"}
