/** Shared TypeScript types for the entire frontend application. */

/* ── Video ─────────────────────────────────────────────────────────── */
export interface VideoRecord {
  id: number;
  filename: string;
  original_name: string;
  upload_date: string;
  duration_seconds: number | null;
  fps: number | null;
  width: number | null;
  height: number | null;
  file_size: number | null;
  status: "pending" | "ready" | "processing" | "completed" | "deleted";
}

/* ── Processing run ─────────────────────────────────────────────────── */
export interface ProcessingRun {
  id: number;
  video_id: number;
  config_json: string;
  start_time: string;
  end_time: string | null;
  total_frames: number;
  processed_frames: number;
  status: "pending" | "processing" | "completed" | "cancelled" | "error";
  output_video_path: string | null;
  output_csv_path: string | null;
}

/* ── Vehicle event ──────────────────────────────────────────────────── */
export interface VehicleEvent {
  id: number;
  run_id: number;
  frame_number: number | null;
  timestamp_seconds: number | null;
  track_id: number | null;
  vehicle_type: "car" | "motorcycle" | "truck" | null;
  vehicle_confidence: number | null;
  speed_kmph: number | null;
  is_violation: boolean;
  bbox_x: number | null;
  bbox_y: number | null;
  bbox_width: number | null;
  bbox_height: number | null;
  thumbnail_path: string | null;
}

/* ── Live stats (from WebSocket) ───────────────────────────────────── */
export interface LiveStats {
  activeTracks: number;
  confirmedTracks: number;
  totalDetections: number;
  avgSpeed: number;
  maxSpeed: number;
  violations: number;
  vehicleTypes: Record<string, number>;
  processingFps: number;
}

/* ── WS messages ───────────────────────────────────────────────────── */
export interface FrameProcessedMsg {
  type: "frame_processed";
  frameNumber: number;
  totalFrames: number;
  progress: number;
  processingFps: number;
  activeTracks: number;
  confirmedTracks: number;
  totalDetections: number;
  avgSpeed: number;
  maxSpeed: number;
  violations: number;
  vehicleTypes: Record<string, number>;
  thumbnail: string | null;
}

export interface EventDetectedMsg {
  type: "event_detected";
  runId: number;
  frameNumber: number;
  timestampSeconds: number;
  trackId: number;
  vehicleType: string;
  vehicleConfidence: number;
  speedKmph: number;
  isViolation: boolean;
  bboxX: number;
  bboxY: number;
  bboxWidth: number;
  bboxHeight: number;
  thumbnailPath: string | null;
}

export type WSMessage = FrameProcessedMsg | EventDetectedMsg | { type: string; [key: string]: unknown };

/* ── Config ─────────────────────────────────────────────────────────── */
export interface ProcessingConfig {
  dimensions: { width: number; height: number };
  roi: { enabled: boolean; points: [number, number][] };
  speedTrap: {
    line1Y: number;
    line2Y: number;
    knownDistanceM: number;
    speedLimitKmph: number;
  };
  preprocessing: {
    useClahe: boolean;
    claheClipLimit: number;
    claheGrid: [number, number];
    blurKernel: [number, number];
  };
  backgroundSubtraction: {
    method: "MOG2" | "KNN";
    mog2History: number;
    mog2VarThreshold: number;
    mog2DetectShadows: boolean;
    knnHistory: number;
    knnDist2Threshold: number;
    knnDetectShadows: boolean;
  };
  contourFiltering: {
    minArea: number;
    maxArea: number;
    minAspectRatio: number;
    maxAspectRatio: number;
    minSolidity: number;
    minExtent: number;
    maxExtent: number;
  };
  tracking: {
    maxMatchDistance: number;
    maxMissedFrames: number;
    confirmFrames: number;
  };
  processing: { warmupFrames: number };
}

export const DEFAULT_CONFIG: ProcessingConfig = {
  dimensions: { width: 1280, height: 720 },
  roi: { enabled: false, points: [] },
  speedTrap: { line1Y: 500, line2Y: 600, knownDistanceM: 10, speedLimitKmph: 60 },
  preprocessing: { useClahe: false, claheClipLimit: 2.0, claheGrid: [8, 8], blurKernel: [5, 5] },
  backgroundSubtraction: {
    method: "MOG2",
    mog2History: 500,
    mog2VarThreshold: 35,
    mog2DetectShadows: false,
    knnHistory: 500,
    knnDist2Threshold: 400,
    knnDetectShadows: false,
  },
  contourFiltering: {
    minArea: 9000,
    maxArea: 150000,
    minAspectRatio: 0.25,
    maxAspectRatio: 5.5,
    minSolidity: 0.45,
    minExtent: 0.35,
    maxExtent: 0.95,
  },
  tracking: { maxMatchDistance: 100, maxMissedFrames: 15, confirmFrames: 5 },
  processing: { warmupFrames: 150 },
};

/* ── Processing status ──────────────────────────────────────────────── */
export type ProcessingStatus = "idle" | "uploading" | "processing" | "completed" | "cancelled" | "error";

/* ── UI tab ─────────────────────────────────────────────────────────── */
export type AppTab = "dashboard" | "analytics" | "events" | "config";
