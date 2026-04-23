"""Track and CentroidTracker — exact implementation from mv_project notebook.

Uses scipy.optimize.linear_sum_assignment (Hungarian algorithm) for optimal
track-to-detection assignment instead of greedy nearest-neighbour.
"""

import numpy as np
from scipy.optimize import linear_sum_assignment
from collections import Counter


# ---------------------------------------------------------------------------
# TRACK
# ---------------------------------------------------------------------------

class Track:
    def __init__(self, track_id: int, centroid: tuple, bbox: tuple, frame_idx: int):
        self.track_id       = track_id
        self.centroids      = [centroid]
        self.bboxes         = [bbox]
        self.first_frame    = frame_idx
        self.last_frame     = frame_idx
        self.missed         = 0
        self.confirmed      = False
        self.line1_frame    = None
        self.line2_frame    = None
        self.speed_kmph     = None
        self.speed_computed = False
        self.violation      = False
        self.line1_crossed  = False
        self.line2_crossed  = False
        self.vehicle_type   = None
        self.vehicle_votes  = []
        self.direction      = None

    def update(self, centroid: tuple, bbox: tuple, frame_idx: int, confirm_frames: int):
        self.centroids.append(centroid)
        self.bboxes.append(bbox)
        self.last_frame = frame_idx
        self.missed     = 0
        if len(self.centroids) >= confirm_frames:
            self.confirmed = True

    def set_vehicle_type(self, vehicle_label: str):
        if vehicle_label and vehicle_label != "vehicle":
            self.vehicle_votes.append(vehicle_label)
            self.vehicle_type = Counter(self.vehicle_votes).most_common(1)[0][0]

    def current_centroid(self) -> tuple:
        return self.centroids[-1]

    def current_bbox(self) -> tuple:
        return self.bboxes[-1]

    def mark_missed(self):
        self.missed += 1


# ---------------------------------------------------------------------------
# CENTROID TRACKER  (Hungarian / linear_sum_assignment)
# ---------------------------------------------------------------------------

class CentroidTracker:
    def __init__(self, max_distance: int = 120, max_missed: int = 15, confirm_frames: int = 5):
        self.next_id        = 1
        self.tracks         = {}          # track_id → Track
        self.max_distance   = max_distance
        self.max_missed     = max_missed
        self.confirm_frames = confirm_frames

    # ---- internal helpers ----

    def _distance_matrix(self, track_ids: list, detections: list) -> np.ndarray:
        D = np.zeros((len(track_ids), len(detections)), dtype=np.float32)
        for i, tid in enumerate(track_ids):
            tx, ty = self.tracks[tid].current_centroid()
            for j, det in enumerate(detections):
                dx, dy = det["centroid"]
                D[i, j] = np.hypot(tx - dx, ty - dy)
        return D

    def _new_track(self, det: dict, frame_idx: int):
        tid = self.next_id
        self.tracks[tid] = Track(tid, det["centroid"], det["bbox"], frame_idx)
        self.next_id += 1

    # ---- public update ----

    def update(self, detections: list, frame_idx: int) -> dict:
        track_ids = list(self.tracks.keys())

        # No existing tracks → register all as new
        if not track_ids:
            for det in detections:
                self._new_track(det, frame_idx)
            return self.tracks

        # No new detections → age all tracks
        if not detections:
            for tid in list(self.tracks.keys()):
                self.tracks[tid].mark_missed()
                if self.tracks[tid].missed > self.max_missed:
                    del self.tracks[tid]
            return self.tracks

        # ── Hungarian assignment ──
        dist = self._distance_matrix(track_ids, detections)
        rows, cols = linear_sum_assignment(dist)

        matched_tracks: set = set()
        matched_dets:   set = set()

        for r, c in zip(rows, cols):
            tid = track_ids[r]
            if dist[r, c] <= self.max_distance:
                self.tracks[tid].update(
                    detections[c]["centroid"],
                    detections[c]["bbox"],
                    frame_idx,
                    self.confirm_frames,
                )
                matched_tracks.add(tid)
                matched_dets.add(c)

        # Age unmatched tracks
        for tid in track_ids:
            if tid not in matched_tracks:
                self.tracks[tid].mark_missed()
                if self.tracks[tid].missed > self.max_missed:
                    del self.tracks[tid]

        # Register unmatched detections as new tracks
        for i, det in enumerate(detections):
            if i not in matched_dets:
                self._new_track(det, frame_idx)

        return self.tracks
