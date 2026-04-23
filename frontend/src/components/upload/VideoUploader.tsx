import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, Film, CheckCircle, AlertCircle, Loader } from "lucide-react";
import { uploadVideo } from "@/services/api";
import { useStore } from "@/store/useStore";

export default function VideoUploader() {
  const { addVideo, setUploadProgress, setStatus } = useStore();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [localProgress, setLocalProgress] = useState(0);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      const maxSize = 500 * 1024 * 1024;
      if (file.size > maxSize) {
        setError("File exceeds 500 MB limit.");
        return;
      }

      setUploading(true);
      setError(null);
      setSuccess(false);
      setStatus("uploading");
      setLocalProgress(0);

      try {
        const video = await uploadVideo(file, (pct) => {
          setLocalProgress(pct);
          setUploadProgress(pct);
        });
        addVideo(video);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } catch (e: unknown) {
        const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Upload failed";
        setError(msg);
      } finally {
        setUploading(false);
        setLocalProgress(0);
        setStatus("idle");
      }
    },
    [addVideo, setUploadProgress, setStatus]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "video/mp4": [".mp4"],
      "video/avi": [".avi"],
      "video/quicktime": [".mov"],
      "video/x-matroska": [".mkv"],
    },
    maxFiles: 1,
    disabled: uploading,
  });

  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <Upload size={16} className="text-blue-400" />
        <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wide">Upload Video</h2>
      </div>

      <div
        {...getRootProps()}
        className={`relative rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer flex flex-col items-center justify-center p-10 text-center
          ${isDragActive ? "border-blue-400 bg-blue-500/10" : "border-slate-700 hover:border-blue-500/60 hover:bg-blue-500/5"}
          ${uploading ? "pointer-events-none opacity-70" : ""}`}
      >
        <input {...getInputProps()} />

        {uploading ? (
          <div className="flex flex-col items-center gap-4 w-full max-w-xs">
            <Loader size={36} className="text-blue-400 animate-spin" />
            <p className="text-sm text-slate-300">Uploading…</p>
            <div className="progress-track w-full">
              <div className="progress-fill" style={{ width: `${localProgress}%` }} />
            </div>
            <p className="text-xs text-slate-500">{localProgress}%</p>
          </div>
        ) : success ? (
          <div className="flex flex-col items-center gap-3">
            <CheckCircle size={40} className="text-green-400" />
            <p className="text-sm text-green-300">Upload complete!</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 rounded-full" style={{ background: isDragActive ? "var(--glow-blue)" : "rgba(30,40,60,0.8)", border: "1px solid var(--border)" }}>
              <Film size={32} className={isDragActive ? "text-blue-400" : "text-slate-500"} />
            </div>
            <div>
              <p className="text-slate-200 font-medium mb-1">
                {isDragActive ? "Drop video here" : "Drag & drop or click to browse"}
              </p>
              <p className="text-slate-500 text-sm">MP4, AVI, MOV, MKV · max 500 MB</p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-3 flex items-center gap-2 text-red-400 text-sm bg-red-500/10 rounded-lg px-3 py-2 border border-red-500/20">
          <AlertCircle size={14} />
          {error}
        </div>
      )}
    </div>
  );
}
