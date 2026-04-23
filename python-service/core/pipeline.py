"""
Motion Pipeline — Vehicle Identification & Speed Monitoring
Exact logic from mv_project_vehicle_identification_final.ipynb,
wrapped in a MotionPipeline class that integrates with the FastAPI queue-based
WebSocket streaming interface.
"""

from __future__ import annotations

import base64
import os
import queue
import threading
from collections import Counter
from typing import Any, Dict, Optional

import cv2
import numpy as np

from core.tracker import CentroidTracker, Track
from core.speed import update_line_crossing, finalize_speed, is_violation
from models.schemas import ProcessingConfig

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(BASE_DIR, "../../data/outputs")
SNAP_DIR   = os.path.join(OUTPUT_DIR, "snapshots")


# ---------------------------------------------------------------------------
# Config helpers (exact from notebook)
# ---------------------------------------------------------------------------

def _pydantic_to_flat(cfg: ProcessingConfig, run_id: int) -> dict:
    """Convert the nested Pydantic ProcessingConfig into the flat dict the pipeline uses."""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(SNAP_DIR, exist_ok=True)

    bs = cfg.backgroundSubtraction
    ct = cfg.contourFiltering
    tr = cfg.tracking
    st = cfg.speedTrap
    pp = cfg.preprocessing
    di = cfg.dimensions

    # ROI polygon — use full-frame trapezoid if not specified
    if cfg.roi.enabled and len(cfg.roi.points) >= 3:
        roi_pts = np.array(cfg.roi.points, dtype=np.int32)
    else:
        w, h = di.width, di.height
        roi_pts = np.array(
            [[220, h - 70], [w - 200, h - 70], [w - 20, int(h * 0.55)], [20, int(h * 0.55)]],
            dtype=np.int32,
        )

    return {
        # Dimensions
        "width":  di.width,
        "height": di.height,

        # ROI
        "roi_points": roi_pts,

        # Speed trap
        "line1_y":          st.line1Y,
        "line2_y":          st.line2Y,
        "known_distance_m": st.knownDistanceM,
        "speed_limit_kmph": st.speedLimitKmph,

        # Preprocessing
        "use_clahe":        pp.useClahe,
        "clahe_clip_limit": pp.claheClipLimit,
        "clahe_grid":       tuple(pp.claheGrid),
        "blur_kernel":      tuple(pp.blurKernel),

        # Background subtractor
        "bg_method":              bs.method,
        "mog2_history":           bs.mog2History,
        "mog2_var_threshold":     bs.mog2VarThreshold,
        "mog2_detect_shadows":    bs.mog2DetectShadows,
        "knn_history":            bs.knnHistory,
        "knn_dist2_threshold":    bs.knnDist2Threshold,
        "knn_detect_shadows":     bs.knnDetectShadows,

        # Contour filtering
        "min_area":          ct.minArea,
        "max_area":          ct.maxArea,
        "min_aspect_ratio":  ct.minAspectRatio,
        "max_aspect_ratio":  ct.maxAspectRatio,
        "min_solidity":      ct.minSolidity,
        "min_extent":        ct.minExtent,
        "max_extent":        ct.maxExtent,

        # Tracking
        "max_match_distance": tr.maxMatchDistance,
        "max_missed_frames":  tr.maxMissedFrames,
        "confirm_frames":     tr.confirmFrames,
        "warmup_frames":      cfg.processing.warmupFrames,

        # Output paths
        "motion_video": os.path.join(OUTPUT_DIR, f"{run_id}_annotated.mp4"),
        "snap_dir":     SNAP_DIR,
    }


# ---------------------------------------------------------------------------
# Utility functions (exact from notebook)
# ---------------------------------------------------------------------------

def _make_writer(path: str, fps: float, width: int, height: int) -> cv2.VideoWriter:
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    return cv2.VideoWriter(path, fourcc, fps, (width, height))


def _build_bg_subtractor(cfg: dict) -> cv2.BackgroundSubtractor:
    if cfg["bg_method"] == "MOG2":
        return cv2.createBackgroundSubtractorMOG2(
            history=cfg["mog2_history"],
            varThreshold=cfg["mog2_var_threshold"],
            detectShadows=cfg["mog2_detect_shadows"],
        )
    return cv2.createBackgroundSubtractorKNN(
        history=cfg["knn_history"],
        dist2Threshold=cfg["knn_dist2_threshold"],
        detectShadows=cfg["knn_detect_shadows"],
    )


def _make_roi_mask(frame_shape: tuple, points: np.ndarray) -> np.ndarray:
    mask = np.zeros(frame_shape[:2], dtype=np.uint8)
    cv2.fillPoly(mask, [points], 255)
    return mask


def _preprocess(frame: np.ndarray, cfg: dict) -> np.ndarray:
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    if cfg["use_clahe"]:
        clahe = cv2.createCLAHE(
            clipLimit=cfg["clahe_clip_limit"],
            tileGridSize=cfg["clahe_grid"],
        )
        gray = clahe.apply(gray)
    gray = cv2.GaussianBlur(gray, cfg["blur_kernel"], 0)
    return gray


def _apply_morphology(fgmask: np.ndarray, cfg: dict) -> np.ndarray:
    """Exact morphology kernels from the notebook."""
    close_kernel  = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13))
    open_kernel   = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    dilate_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))

    fgmask = cv2.morphologyEx(fgmask, cv2.MORPH_CLOSE,  close_kernel,  iterations=2)
    fgmask = cv2.morphologyEx(fgmask, cv2.MORPH_OPEN,   open_kernel,   iterations=1)
    fgmask = cv2.dilate(fgmask, dilate_kernel, iterations=1)
    return fgmask


def _contour_features(cnt: np.ndarray) -> dict:
    area      = cv2.contourArea(cnt)
    x, y, w, h = cv2.boundingRect(cnt)
    aspect_ratio = w / float(h + 1e-6)
    bbox_area    = float(w * h + 1e-6)
    extent       = area / bbox_area

    hull      = cv2.convexHull(cnt)
    hull_area = cv2.contourArea(hull) + 1e-6
    solidity  = area / hull_area

    M = cv2.moments(cnt)
    if M["m00"] != 0:
        cx = int(M["m10"] / M["m00"])
        cy = int(M["m01"] / M["m00"])
    else:
        cx, cy = x + w // 2, y + h // 2

    return {
        "area":         area,
        "bbox":         (x, y, w, h),
        "aspect_ratio": aspect_ratio,
        "solidity":     solidity,
        "extent":       extent,
        "centroid":     (cx, cy),
    }


def _filter_contours(contours: list, cfg: dict) -> list:
    detections = []
    for cnt in contours:
        feat = _contour_features(cnt)
        if feat["area"]         < cfg["min_area"]:          continue
        if feat["area"]         > cfg["max_area"]:          continue
        if feat["aspect_ratio"] < cfg["min_aspect_ratio"]:  continue
        if feat["aspect_ratio"] > cfg["max_aspect_ratio"]:  continue
        if feat["solidity"]     < cfg["min_solidity"]:      continue
        if feat["extent"]       < cfg["min_extent"]:        continue
        if feat["extent"]       > cfg["max_extent"]:        continue
        detections.append(feat)
    return detections


def _merge_detections(detections: list, merge_distance: int = 50) -> list:
    """Merge nearby detections into a single bounding box."""
    if len(detections) <= 1:
        return detections

    merged = []
    used   = set()

    for i in range(len(detections)):
        if i in used:
            continue
        group = [i]
        used.add(i)

        for j in range(len(detections)):
            if j in used:
                continue
            c1 = np.array(detections[i]["centroid"])
            c2 = np.array(detections[j]["centroid"])
            if np.linalg.norm(c1 - c2) < merge_distance:
                group.append(j)
                used.add(j)

        xs, ys, xe, ye = [], [], [], []
        for idx in group:
            x, y, w, h = detections[idx]["bbox"]
            xs.append(x);      ys.append(y)
            xe.append(x + w);  ye.append(y + h)

        x1, y1 = min(xs), min(ys)
        x2, y2 = max(xe), max(ye)
        merged.append({
            "area":         1,
            "bbox":         (x1, y1, x2 - x1, y2 - y1),
            "aspect_ratio": 1,
            "solidity":     1,
            "extent":       1,
            "centroid":     ((x1 + x2) // 2, (y1 + y2) // 2),
        })

    return merged


def _classify_vehicle_heuristic(box_w: int, box_h: int) -> str:
    """Heuristic classification by bounding-box dimensions (exact from notebook)."""
    aspect = box_w / max(box_h, 1)
    if box_w * box_h < 1500:
        return "motorcycle"
    elif aspect > 2.2:
        return "bus/truck"
    elif aspect > 1.2:
        return "car"
    else:
        return "vehicle"


def _draw_roi(frame: np.ndarray, points: np.ndarray):
    cv2.polylines(frame, [points], True, (0, 255, 255), 2)


def _draw_speed_lines(frame: np.ndarray, cfg: dict):
    w = frame.shape[1]
    cv2.line(frame, (0, cfg["line1_y"]), (w, cfg["line1_y"]), (255, 0, 0), 2)
    cv2.line(frame, (0, cfg["line2_y"]), (w, cfg["line2_y"]), (0, 0, 255), 2)


def _frame_to_b64(frame: np.ndarray, width: int = 320, height: int = 180) -> str:
    """Encode a frame as base64 JPEG for WebSocket thumbnail streaming."""
    thumb = cv2.resize(frame, (width, height))
    _, buf = cv2.imencode(".jpg", thumb, [cv2.IMWRITE_JPEG_QUALITY, 70])
    return "data:image/jpeg;base64," + base64.b64encode(buf).decode()


# ---------------------------------------------------------------------------
# Motion Pipeline (MotionPipeline class wrapping exact notebook logic)
# ---------------------------------------------------------------------------

class MotionPipeline:
    """
    Wraps the notebook's run_motion_pipeline function in a class that:
      - accepts a Pydantic ProcessingConfig and run_id
      - exposes a .run(video_path, queue, cancel_event) method
      - pushes WebSocket messages (frame_processed / event_detected) onto the queue
      - pushes None sentinel when done
    """

    def __init__(self, pydantic_cfg: ProcessingConfig, run_id: int):
        self.cfg    = _pydantic_to_flat(pydantic_cfg, run_id)
        self.run_id = run_id

    # ── public entry point ───────────────────────────────────────────────────

    def run(self, video_path: str, q: queue.Queue, cancel: threading.Event) -> dict:
        """
        Process a video file, streaming progress/events onto q.
        Sends None sentinel when finished (or cancelled).
        Returns a summary dict.
        """
        cfg = self.cfg
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            q.put({"type": "error", "message": f"Cannot open video: {video_path}"})
            q.put(None)
            return {}

        fps = cap.get(cv2.CAP_PROP_FPS)
        if fps <= 1:
            fps = 25.0

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        writer   = _make_writer(cfg["motion_video"], fps, cfg["width"], cfg["height"])
        bg       = _build_bg_subtractor(cfg)
        tracker  = CentroidTracker(
            max_distance=cfg["max_match_distance"],
            max_missed=cfg["max_missed_frames"],
            confirm_frames=cfg["confirm_frames"],
        )

        all_events  = []
        frame_idx   = 0
        THUMB_EVERY = 5   # emit a thumbnail every N frames

        while True:
            if cancel.is_set():
                break

            ret, frame = cap.read()
            if not ret:
                break

            # ── Resize ──────────────────────────────────────────────────────
            frame = cv2.resize(frame, (cfg["width"], cfg["height"]))

            # ── ROI mask ────────────────────────────────────────────────────
            roi       = _make_roi_mask(frame.shape, cfg["roi_points"])
            roi_frame = cv2.bitwise_and(frame, frame, mask=roi)

            # ── Preprocess + BG subtraction ─────────────────────────────────
            gray   = _preprocess(roi_frame, cfg)
            fgmask = bg.apply(gray)

            # ── Warm-up: let the BG model stabilise ─────────────────────────
            if frame_idx < cfg["warmup_frames"]:
                writer.write(frame)
                frame_idx += 1
                if frame_idx % THUMB_EVERY == 0:
                    q.put({
                        "type":            "frame_processed",
                        "frameNumber":     frame_idx,
                        "totalFrames":     total_frames,
                        "progress":        round(frame_idx / max(total_frames, 1) * 100, 1),
                        "processingFps":   0.0,
                        "activeTracks":    0,
                        "confirmedTracks": 0,
                        "totalDetections": 0,
                        "avgSpeed":        0.0,
                        "maxSpeed":        0.0,
                        "violations":      0,
                        "vehicleTypes":    {"car": 0, "motorcycle": 0, "bus/truck": 0},
                        "thumbnail":       _frame_to_b64(frame),
                    })
                continue

            # ── Threshold + morphology ───────────────────────────────────────
            _, fgmask = cv2.threshold(fgmask, 200, 255, cv2.THRESH_BINARY)
            clean     = _apply_morphology(fgmask, cfg)

            # ── Contour → detection ─────────────────────────────────────────
            contours, _ = cv2.findContours(clean, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            detections  = _filter_contours(contours, cfg)
            detections  = _merge_detections(detections, merge_distance=50)

            # ── Tracker update ──────────────────────────────────────────────
            tracks = tracker.update(detections, frame_idx)

            # ── Annotation overlays ─────────────────────────────────────────
            _draw_roi(frame, cfg["roi_points"])
            _draw_speed_lines(frame, cfg)

            new_events_this_frame = []

            for tid, track in list(tracks.items()):
                # Speed trap line crossing check
                update_line_crossing(track, cfg)

                vehicle_label = "vehicle"
                if track.confirmed:
                    x, y, w, h = track.current_bbox()
                    vehicle_label = _classify_vehicle_heuristic(w, h)
                    track.set_vehicle_type(vehicle_label)

                # Finalise speed as soon as both lines crossed
                if track.line1_crossed and track.line2_crossed and track.speed_kmph is None:
                    spd = finalize_speed(track, fps, cfg)
                    if spd is not None:
                        track.violation = is_violation(spd, cfg)

                        x, y, w, h = track.current_bbox()
                        ts          = frame_idx / fps

                        event = {
                            "frameNumber":      frame_idx,
                            "timestampSeconds": round(ts, 2),
                            "trackId":          tid,
                            "vehicleType":      track.vehicle_type or vehicle_label,
                            "vehicleConfidence": 0.85,
                            "speedKmph":        round(spd, 2),
                            "isViolation":      track.violation,
                            "bboxX":            x,
                            "bboxY":            y,
                            "bboxWidth":        w,
                            "bboxHeight":       h,
                            "thumbnailPath":    None,
                        }
                        all_events.append(event)
                        new_events_this_frame.append(event)

                # ── Draw bounding box and label ──────────────────────────────
                x, y, w, h = track.current_bbox()
                cx, cy     = track.current_centroid()

                if track.violation:
                    color = (0, 0, 255)      # red
                elif track.confirmed:
                    color = (0, 165, 255)    # orange
                else:
                    color = (0, 255, 0)      # green

                cv2.rectangle(frame, (x, y), (x + w, y + h), color, 2)
                cv2.circle(frame, (cx, cy), 4, color, -1)

                vtype  = track.vehicle_type or vehicle_label
                label  = f"ID {tid} | {vtype}"
                if track.speed_kmph is not None:
                    label += f" | {track.speed_kmph:.1f} km/h"
                if track.violation:
                    label += " | OVERSPEED"

                cv2.putText(frame, label, (x, max(y - 8, 12)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 2)

            # ── HUD overlay (exact from notebook) ───────────────────────────
            confirmed_cnt = sum(1 for t in tracks.values() if t.confirmed)
            speeds_lst    = [t.speed_kmph for t in tracks.values() if t.speed_kmph is not None]
            avg_speed     = float(np.mean(speeds_lst))  if speeds_lst else 0.0
            max_speed     = float(np.max(speeds_lst))   if speeds_lst else 0.0
            violations    = sum(1 for t in tracks.values() if t.violation)

            cv2.rectangle(frame, (10, 10), (430, 145), (0, 0, 0), -1)
            cv2.putText(frame, f"Confirmed tracks: {confirmed_cnt}", (20, 40),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
            cv2.putText(frame, f"Avg speed: {avg_speed:.1f} km/h", (20, 70),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
            cv2.putText(frame, f"Max speed: {max_speed:.1f} km/h", (20, 100),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
            cv2.putText(frame, f"Violations: {violations}", (20, 130),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)

            writer.write(frame)

            # ── Stream events to WS clients ─────────────────────────────────
            for ev in new_events_this_frame:
                q.put({"type": "event_detected", **ev})

            # ── Stream frame progress every THUMB_EVERY frames ───────────────
            if frame_idx % THUMB_EVERY == 0:
                vtype_counts = Counter(
                    t.vehicle_type
                    for t in tracks.values()
                    if t.vehicle_type and t.confirmed
                )
                q.put({
                    "type":            "frame_processed",
                    "frameNumber":     frame_idx,
                    "totalFrames":     total_frames,
                    "progress":        round(frame_idx / max(total_frames, 1) * 100, 1),
                    "processingFps":   fps,
                    "activeTracks":    len(tracks),
                    "confirmedTracks": confirmed_cnt,
                    "totalDetections": len(all_events),
                    "avgSpeed":        round(avg_speed, 1),
                    "maxSpeed":        round(max_speed, 1),
                    "violations":      sum(1 for e in all_events if e["isViolation"]),
                    "vehicleTypes":    {
                        "car":       vtype_counts.get("car", 0),
                        "motorcycle": vtype_counts.get("motorcycle", 0),
                        "bus/truck": vtype_counts.get("bus/truck", 0),
                    },
                    "thumbnail": _frame_to_b64(frame),
                })

            frame_idx += 1

        cap.release()
        writer.release()

        # ── Build summary dict ───────────────────────────────────────────────
        all_speeds = [e["speedKmph"] for e in all_events]
        summary = {
            "processedFrames":  frame_idx,
            "totalFrames":      total_frames,
            "outputVideoPath":  cfg["motion_video"],
            "events":           all_events,
            "totalEvents":      len(all_events),
            "totalViolations":  sum(1 for e in all_events if e["isViolation"]),
            "avgSpeed":         round(float(np.mean(all_speeds)), 1) if all_speeds else 0.0,
            "maxSpeed":         round(float(np.max(all_speeds)), 1)  if all_speeds else 0.0,
        }

        # ── Send completion sentinel ─────────────────────────────────────────
        q.put(None)
        return summary
