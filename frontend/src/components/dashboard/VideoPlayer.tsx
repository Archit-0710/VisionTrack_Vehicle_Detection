import { useRef, useState } from "react";
import { Play, Pause, Download, Maximize2, Monitor } from "lucide-react";
import { downloadVideo } from "@/services/api";
import { useStore } from "@/store/useStore";

export default function VideoPlayer() {
  const { thumbnail, status, activeRunId } = useStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  const isDone = status === "completed";
  const isProcessing = status === "processing";

  const videoUrl = isDone && activeRunId ? `/outputs/${activeRunId}_annotated.mp4` : null;

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (playing) {
      videoRef.current.pause();
      setPlaying(false);
    } else {
      videoRef.current.play();
      setPlaying(true);
    }
  };

  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2">
          <Monitor size={14} className="text-blue-400" />
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            {isDone ? "Annotated Output" : isProcessing ? "Live Feed" : "Video Player"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isDone && activeRunId && (
            <button
              className="btn btn-primary text-xs py-1 px-3"
              onClick={() => downloadVideo(activeRunId)}
            >
              <Download size={12} />
              Download
            </button>
          )}
        </div>
      </div>

      {/* Player body */}
      <div className="relative bg-black aspect-video flex items-center justify-center">
        {/* Completed → show real video */}
        {videoUrl && (
          <>
            <video
              ref={videoRef}
              src={videoUrl}
              className="w-full h-full object-contain"
              onEnded={() => setPlaying(false)}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
            />
            {/* Play/pause overlay */}
            <button
              onClick={togglePlay}
              className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
              style={{ background: "rgba(0,0,0,0.3)" }}
            >
              <div className="p-4 rounded-full" style={{ background: "rgba(59,130,246,0.8)" }}>
                {playing ? <Pause size={28} className="text-white" /> : <Play size={28} className="text-white" />}
              </div>
            </button>
          </>
        )}

        {/* Processing → show live thumbnail */}
        {isProcessing && !videoUrl && (
          <>
            {thumbnail ? (
              <img src={thumbnail} alt="Live frame" className="w-full h-full object-contain" />
            ) : (
              <div className="flex flex-col items-center gap-3 text-slate-600">
                <div className="w-12 h-12 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
                <p className="text-sm">Processing frames…</p>
              </div>
            )}
            {/* Live badge */}
            <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-600/90 text-white text-xs font-bold px-2 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              LIVE
            </div>
          </>
        )}

        {/* Idle state */}
        {!isProcessing && !videoUrl && (
          <div className="flex flex-col items-center gap-3 text-slate-600">
            <Monitor size={48} strokeWidth={1} />
            <p className="text-sm">Select a video and start processing</p>
          </div>
        )}
      </div>

      {/* Controls for completed video */}
      {videoUrl && (
        <div className="px-4 py-3 flex items-center gap-3 border-t" style={{ borderColor: "var(--border)" }}>
          <button onClick={togglePlay} className="btn btn-ghost py-1.5 px-3">
            {playing ? <Pause size={14} /> : <Play size={14} />}
            {playing ? "Pause" : "Play"}
          </button>
          <input
            type="range"
            min={0}
            max={videoRef.current?.duration ?? 100}
            step={0.1}
            defaultValue={0}
            className="flex-1"
            onChange={(e) => {
              if (videoRef.current) videoRef.current.currentTime = parseFloat(e.target.value);
            }}
          />
        </div>
      )}
    </div>
  );
}
