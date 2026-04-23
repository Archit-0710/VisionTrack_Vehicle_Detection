"""Pydantic models for request/response validation."""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class DimensionsConfig(BaseModel):
    width: int = 1280             # notebook default
    height: int = 720             # notebook default


class ROIConfig(BaseModel):
    enabled: bool = False
    points: List[List[int]] = Field(default_factory=list)


class SpeedTrapConfig(BaseModel):
    line1Y: int = 180
    line2Y: int = 240
    knownDistanceM: float = 10.0
    speedLimitKmph: float = 60.0


class PreprocessingConfig(BaseModel):
    useClahe: bool = False
    claheClipLimit: float = 2.0
    claheGrid: List[int] = Field(default=[8, 8])
    blurKernel: List[int] = Field(default=[5, 5])


class BackgroundSubtractionConfig(BaseModel):
    method: str = "MOG2"
    mog2History: int = 500
    mog2VarThreshold: float = 35.0
    mog2DetectShadows: bool = False
    knnHistory: int = 500
    knnDist2Threshold: float = 400.0
    knnDetectShadows: bool = False


class ContourFilteringConfig(BaseModel):
    minArea: int = 9000          # notebook default
    maxArea: int = 150000
    minAspectRatio: float = 0.25
    maxAspectRatio: float = 5.5
    minSolidity: float = 0.45
    minExtent: float = 0.35       # notebook default
    maxExtent: float = 0.95


class TrackingConfig(BaseModel):
    maxMatchDistance: int = 100
    maxMissedFrames: int = 15
    confirmFrames: int = 5


class ProcessingMeta(BaseModel):
    warmupFrames: int = 150       # notebook default (150 frames)


class ProcessingConfig(BaseModel):
    dimensions: DimensionsConfig = Field(default_factory=DimensionsConfig)
    roi: ROIConfig = Field(default_factory=ROIConfig)
    speedTrap: SpeedTrapConfig = Field(default_factory=SpeedTrapConfig)
    preprocessing: PreprocessingConfig = Field(default_factory=PreprocessingConfig)
    backgroundSubtraction: BackgroundSubtractionConfig = Field(
        default_factory=BackgroundSubtractionConfig
    )
    contourFiltering: ContourFilteringConfig = Field(default_factory=ContourFilteringConfig)
    tracking: TrackingConfig = Field(default_factory=TrackingConfig)
    processing: ProcessingMeta = Field(default_factory=ProcessingMeta)


class VideoMetadata(BaseModel):
    id: int
    filename: str
    original_name: str
    upload_date: str
    duration_seconds: Optional[float]
    fps: Optional[float]
    width: Optional[int]
    height: Optional[int]
    file_size: Optional[int]
    status: str


class ProcessRunRequest(BaseModel):
    video_id: int
    config: ProcessingConfig = Field(default_factory=ProcessingConfig)


class RunStatus(BaseModel):
    run_id: int
    video_id: int
    status: str
    processed_frames: int
    total_frames: int
    progress: float
    output_video_path: Optional[str]
    output_csv_path: Optional[str]


class VehicleEventOut(BaseModel):
    id: int
    run_id: int
    frame_number: Optional[int]
    timestamp_seconds: Optional[float]
    track_id: Optional[int]
    vehicle_type: Optional[str]
    vehicle_confidence: Optional[float]
    speed_kmph: Optional[float]
    is_violation: bool
    bbox_x: Optional[int]
    bbox_y: Optional[int]
    bbox_width: Optional[int]
    bbox_height: Optional[int]
    thumbnail_path: Optional[str]


class RunResults(BaseModel):
    run_id: int
    status: str
    total_events: int
    total_violations: int
    avg_speed: Optional[float]
    max_speed: Optional[float]
    vehicle_type_counts: Dict[str, int]
    events: List[Dict[str, Any]]
