import { useEffect } from "react";
import { Film, Trash2, Play, Clock, Monitor, Zap, CheckCircle2, Loader } from "lucide-react";
import { fetchVideos, deleteVideo } from "@/services/api";
import { useStore } from "@/store/useStore";
import type { VideoRecord } from "@/types";

function fmtSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function fmtDuration(s: number | null): string {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function StatusBadge({ status }: { status: VideoRecord["status"] }) {
  const map: Record<string, string> = {
    ready:      "badge badge-green",
    processing: "badge badge-blue",
    completed:  "badge badge-purple",
    pending:    "badge badge-orange",
    deleted:    "badge badge-red",
  };
  return <span className={map[status] ?? "badge badge-orange"}>{status}</span>;
}

export default function VideoList() {
  const { videos, setVideos, removeVideo, selectedVideoId, setSelectedVideoId } = useStore();

  useEffect(() => {
    fetchVideos().then(setVideos).catch(console.error);
  }, [setVideos]);

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this video?")) return;
    await deleteVideo(id);
    removeVideo(id);
    if (selectedVideoId === id) setSelectedVideoId(null);
  };

  if (videos.length === 0) {
    return (
      <div className="glass-card p-6 text-center">
        <Film size={32} className="text-slate-600 mx-auto mb-2" />
        <p className="text-slate-500 text-sm">No videos uploaded yet</p>
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-5 py-3 border-b" style={{ borderColor: "var(--border)" }}>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Uploaded Videos</h3>
      </div>
      <div className="divide-y" style={{ divideColor: "var(--border-subtle)" }}>
        {videos.map((v) => (
          <div
            key={v.id}
            onClick={() => setSelectedVideoId(v.id)}
            className={`flex items-center gap-4 px-5 py-3 cursor-pointer transition-colors group
              ${selectedVideoId === v.id ? "bg-blue-600/10" : "hover:bg-white/3"}`}
          >
            {/* icon */}
            <div className={`p-2 rounded-lg flex-shrink-0 ${selectedVideoId === v.id ? "bg-blue-600/20" : "bg-slate-800"}`}>
              <Film size={16} className={selectedVideoId === v.id ? "text-blue-400" : "text-slate-500"} />
            </div>

            {/* info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-200 truncate font-medium">{v.original_name}</p>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-xs text-slate-500 flex items-center gap-1"><Clock size={10} />{fmtDuration(v.duration_seconds)}</span>
                <span className="text-xs text-slate-500 flex items-center gap-1"><Monitor size={10} />{v.width}×{v.height}</span>
                <span className="text-xs text-slate-500 flex items-center gap-1"><Zap size={10} />{v.fps ? `${v.fps} fps` : "—"}</span>
                <span className="text-xs text-slate-600">{fmtSize(v.file_size)}</span>
              </div>
            </div>

            <StatusBadge status={v.status} />

            {/* actions */}
            <button
              onClick={(e) => handleDelete(v.id, e)}
              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-all"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
