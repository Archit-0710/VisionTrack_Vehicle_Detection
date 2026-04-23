import { useStore } from "@/store/useStore";
import { Clock, FrameIcon } from "lucide-react";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function ProgressBar() {
  const { status, progress, currentFrame, totalFrames, liveStats } = useStore();

  if (status === "idle") return null;

  const isProcessing = status === "processing";
  const progressDisplay = Math.min(progress, 100);

  return (
    <div className="glass-card px-5 py-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <FrameIcon size={14} className="text-slate-500" />
          <span className="text-xs text-slate-400">
            Frame{" "}
            <span className="font-mono text-slate-200">{currentFrame.toLocaleString()}</span>
            {" / "}
            <span className="font-mono text-slate-400">{totalFrames.toLocaleString()}</span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          {isProcessing && (
            <span className="text-xs text-blue-400 font-mono">
              {liveStats.processingFps.toFixed(1)} fps
            </span>
          )}
          <span className="text-xs font-semibold text-slate-200 font-mono">
            {progressDisplay.toFixed(1)}%
          </span>
        </div>
      </div>

      <div className="progress-track">
        <div
          className="progress-fill"
          style={{ width: `${progressDisplay}%` }}
        />
      </div>

      <div className="flex justify-between mt-2">
        <span className="text-xs text-slate-600">
          {status === "completed" && "✓ Completed"}
          {status === "cancelled" && "⊘ Cancelled"}
          {status === "error" && "✗ Error"}
          {isProcessing && "Processing…"}
        </span>
        <span className="text-xs text-slate-600">
          {status === "completed" ? "Done" : ""}
        </span>
      </div>
    </div>
  );
}
