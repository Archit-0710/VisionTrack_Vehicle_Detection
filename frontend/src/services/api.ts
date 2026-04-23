/** Typed axios wrappers for the Python FastAPI service (via Vite proxy). */
import axios from "axios";
import type { VideoRecord, VehicleEvent, ProcessingConfig, ProcessingRun } from "@/types";

const BASE = "/api";

const api = axios.create({ baseURL: BASE, timeout: 30_000 });

// ---- Upload ----
export async function uploadVideo(
  file: File,
  onProgress?: (pct: number) => void
): Promise<VideoRecord> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post<{ video: VideoRecord }>("/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
    },
  });
  return data.video;
}

// ---- Videos ----
export async function fetchVideos(): Promise<VideoRecord[]> {
  const { data } = await api.get<{ videos: VideoRecord[] }>("/videos");
  return data.videos;
}

export async function fetchVideo(id: number): Promise<{ video: VideoRecord; runs: ProcessingRun[] }> {
  const { data } = await api.get(`/videos/${id}`);
  return data;
}

export async function deleteVideo(id: number): Promise<void> {
  await api.delete(`/videos/${id}`);
}

// ---- Processing ----
export async function startProcessing(
  videoId: number,
  config?: Partial<ProcessingConfig>
): Promise<{ run_id: number; status: string }> {
  const { data } = await api.post("/process", { video_id: videoId, config: config ?? {} });
  return data;
}

export async function cancelProcessing(runId: number): Promise<void> {
  await api.delete(`/process/${runId}`);
}

export async function fetchRunStatus(runId: number) {
  const { data } = await api.get(`/process/${runId}/status`);
  return data;
}

// ---- Results ----
export async function fetchResults(runId: number): Promise<{
  run_id: number;
  status: string;
  total_events: number;
  total_violations: number;
  avg_speed: number;
  max_speed: number;
  vehicle_type_counts: Record<string, number>;
  events: VehicleEvent[];
}> {
  const { data } = await api.get(`/results/${runId}`);
  return data;
}

// ---- Downloads ----
export function downloadVideo(runId: number): void {
  window.location.href = `${BASE}/runs/${runId}/download/video`;
}

export function downloadCSV(runId: number): void {
  window.location.href = `${BASE}/runs/${runId}/download/csv`;
}

export function downloadJSON(runId: number): void {
  window.location.href = `${BASE}/runs/${runId}/download/json`;
}

export default api;
