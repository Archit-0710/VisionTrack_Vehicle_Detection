"""Speed estimation helpers — exact implementation from mv_project notebook.

Uses dual virtual trip-wire line crossing: speed = distance / time * 3.6
"""


def update_line_crossing(track, cfg: dict):
    """Check if the track's last movement crossed line1 or line2."""
    if len(track.centroids) < 2:
        return

    prev_y = track.centroids[-2][1]
    curr_y = track.centroids[-1][1]

    line1_y = cfg["line1_y"]
    line2_y = cfg["line2_y"]

    if not track.line1_crossed:
        if (prev_y < line1_y <= curr_y) or (prev_y > line1_y >= curr_y):
            track.line1_crossed = True
            track.line1_frame   = track.last_frame

    if not track.line2_crossed:
        if (prev_y < line2_y <= curr_y) or (prev_y > line2_y >= curr_y):
            track.line2_crossed = True
            track.line2_frame   = track.last_frame


def finalize_speed(track, fps: float, cfg: dict):
    """Compute speed (km/h) from the two crossing frames. Returns None if not measurable."""
    if track.speed_computed:
        return track.speed_kmph

    if track.line1_frame is None or track.line2_frame is None:
        return None

    dt_frames = abs(track.line2_frame - track.line1_frame)
    if dt_frames == 0:
        return None

    dt    = dt_frames / fps
    speed = (cfg["known_distance_m"] / dt) * 3.6

    track.speed_kmph    = speed
    track.speed_computed = True
    track.direction     = "towards" if track.line1_frame < track.line2_frame else "away"

    return speed


def is_violation(speed_kmph, cfg: dict) -> bool:
    """Return True if the measured speed exceeds the configured limit."""
    return speed_kmph is not None and speed_kmph > cfg["speed_limit_kmph"]
