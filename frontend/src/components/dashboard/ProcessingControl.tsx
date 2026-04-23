import { useState, useEffect } from "react";
import { Play, Square, Loader, Download, RefreshCw } from "lucide-react";
import { startProcessing, cancelProcessing, fetchResults } from "@/services/api";
import { getSocket, subscribeToRun, unsubscribeFromRun } from "@/services/socketClient";
import { useStore } from "@/store/useStore";
import type { VehicleEvent } from "@/types";

export default function ProcessingControl() {
  const {
    selectedVideoId, status, setStatus, activeRunId, setActiveRunId,
    config, applyFrameUpdate, addEvent, clearEvents, setResults, resetProcessing,
  } = useStore();

  const [error, setError] = useState<string | null>(null);

  /* ── Wire up Socket.io events ── */
  useEffect(() => {
    const socket = getSocket();

    const onFrameProcessed = (msg: Parameters<typeof applyFrameUpdate>[0]) => {
      applyFrameUpdate(msg);
    };

    const onEventDetected = (msg: {
      trackId: number; vehicleType: string; speedKmph: number; isViolation: boolean;
      frameNumber: number; timestampSeconds: number; vehicleConfidence: number;
      bboxX: number; bboxY: number; bboxWidth: number; bboxHeight: number;
      thumbnailPath?: string;
    }) => {
      addEvent({
        track_id: msg.trackId,
        vehicle_type: msg.vehicleType as VehicleEvent["vehicle_type"],
        speed_kmph: msg.speedKmph,
        is_violation: msg.isViolation,
        frame_number: msg.frameNumber,
        timestamp_seconds: msg.timestampSeconds,
        vehicle_confidence: msg.vehicleConfidence,
        bbox_x: msg.bboxX,
        bbox_y: msg.bboxY,
        bbox_width: msg.bboxWidth,
        bbox_height: msg.bboxHeight,
        thumbnail_path: msg.thumbnailPath ?? null,
      });
    };

    const onComplete = async (msg: { runId?: number }) => {
      setStatus("completed");
      const rid = msg.runId ?? activeRunId;
      if (rid) {
        try {
          const res = await fetchResults(rid);
          setResults({
            totalEvents: res.total_events,
            totalViolations: res.total_violations,
            avgSpeed: res.avg_speed,
            maxSpeed: res.max_speed,
            vehicleTypeCounts: res.vehicle_type_counts,
          });
        } catch { /* ignore */ }
      }
    };

    const onError = (msg: { message?: string }) => {
      setError(msg.message ?? "Processing error");
      setStatus("error");
    };

    socket.on("frame_processed", onFrameProcessed);
    socket.on("event_detected", onEventDetected);
    socket.on("processing_complete", onComplete);
    socket.on("error", onError);

    return () => {
      socket.off("frame_processed", onFrameProcessed);
      socket.off("event_detected", onEventDetected);
      socket.off("processing_complete", onComplete);
      socket.off("error", onError);
    };
  }, [activeRunId, applyFrameUpdate, addEvent, setStatus, setResults]);

  const handleStart = async () => {
    if (!selectedVideoId) return;
    setError(null);
    clearEvents();
    resetProcessing();
    setStatus("processing");
    try {
      const { run_id } = await startProcessing(selectedVideoId, config);
      setActiveRunId(run_id);
      subscribeToRun(run_id);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Failed to start";
      setError(msg);
      setStatus("error");
    }
  };

  const handleStop = async () => {
    if (!activeRunId) return;
    unsubscribeFromRun(activeRunId);
    await cancelProcessing(activeRunId);
    setStatus("cancelled");
  };

  const handleReset = () => {
    if (activeRunId) unsubscribeFromRun(activeRunId);
    resetProcessing();
    setError(null);
  };

  const isProcessing = status === "processing";
  const isIdle = status === "idle" || status === "cancelled" || status === "error";
  const isDone = status === "completed";

  return (
    <div className="glass-card p-5">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">
        Processing Controls
      </h3>

      <div className="flex items-center gap-3 flex-wrap">
        {/* Start */}
        <button
          className="btn btn-success"
          onClick={handleStart}
          disabled={!selectedVideoId || isProcessing}
        >
          {isProcessing ? <Loader size={14} className="animate-spin" /> : <Play size={14} />}
          {isProcessing ? "Processing…" : "Start Processing"}
        </button>

        {/* Stop */}
        <button
          className="btn btn-danger"
          onClick={handleStop}
          disabled={!isProcessing}
        >
          <Square size={14} />
          Stop
        </button>

        {/* Reset */}
        {(isDone || status === "cancelled" || status === "error") && (
          <button className="btn btn-ghost" onClick={handleReset}>
            <RefreshCw size={14} />
            Reset
          </button>
        )}
      </div>

      {!selectedVideoId && (
        <p className="text-xs text-slate-500 mt-3">Select a video from the list to begin.</p>
      )}

      {error && (
        <p className="text-xs text-red-400 mt-3 bg-red-500/10 rounded px-3 py-2 border border-red-500/20">
          {error}
        </p>
      )}

      {isDone && (
        <p className="text-xs text-green-400 mt-3 bg-green-500/10 rounded px-3 py-2 border border-green-500/20">
          ✓ Processing complete
        </p>
      )}
    </div>
  );
}
