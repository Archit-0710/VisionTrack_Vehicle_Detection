import { create } from "zustand";
import type {
  VideoRecord,
  ProcessingRun,
  VehicleEvent,
  LiveStats,
  ProcessingStatus,
  AppTab,
  ProcessingConfig,
} from "@/types";
import { DEFAULT_CONFIG } from "@/types";

interface ProcessingStore {
  /* ── Navigation ── */
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;

  /* ── Videos ── */
  videos: VideoRecord[];
  setVideos: (videos: VideoRecord[]) => void;
  addVideo: (video: VideoRecord) => void;
  removeVideo: (id: number) => void;
  selectedVideoId: number | null;
  setSelectedVideoId: (id: number | null) => void;

  /* ── Runs ── */
  runs: ProcessingRun[];
  activeRunId: number | null;
  setActiveRunId: (id: number | null) => void;

  /* ── Processing state ── */
  status: ProcessingStatus;
  setStatus: (s: ProcessingStatus) => void;
  currentFrame: number;
  totalFrames: number;
  progress: number;
  elapsedSeconds: number;
  uploadProgress: number;
  setUploadProgress: (p: number) => void;

  liveStats: LiveStats;
  thumbnail: string | null;

  /* ── Events ── */
  events: VehicleEvent[];
  addEvent: (e: Partial<VehicleEvent>) => void;
  clearEvents: () => void;

  /* ── Frame update from WebSocket ── */
  applyFrameUpdate: (msg: {
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
  }) => void;

  /* ── Config ── */
  config: ProcessingConfig;
  setConfig: (c: Partial<ProcessingConfig>) => void;
  resetConfig: () => void;

  /* ── Results (post-completion) ── */
  results: {
    totalEvents: number;
    totalViolations: number;
    avgSpeed: number;
    maxSpeed: number;
    vehicleTypeCounts: Record<string, number>;
  } | null;
  setResults: (r: ProcessingStore["results"]) => void;

  /* ── Reset ── */
  resetProcessing: () => void;
}

const initialLiveStats: LiveStats = {
  activeTracks: 0,
  confirmedTracks: 0,
  totalDetections: 0,
  avgSpeed: 0,
  maxSpeed: 0,
  violations: 0,
  vehicleTypes: { car: 0, motorcycle: 0, truck: 0 },
  processingFps: 0,
};

let eventIdCounter = 1;

export const useStore = create<ProcessingStore>((set) => ({
  /* ── Navigation ── */
  activeTab: "dashboard",
  setActiveTab: (tab) => set({ activeTab: tab }),

  /* ── Videos ── */
  videos: [],
  setVideos: (videos) => set({ videos }),
  addVideo: (video) => set((s) => ({ videos: [video, ...s.videos] })),
  removeVideo: (id) => set((s) => ({ videos: s.videos.filter((v) => v.id !== id) })),
  selectedVideoId: null,
  setSelectedVideoId: (id) => set({ selectedVideoId: id }),

  /* ── Runs ── */
  runs: [],
  activeRunId: null,
  setActiveRunId: (id) => set({ activeRunId: id }),

  /* ── Processing state ── */
  status: "idle",
  setStatus: (status) => set({ status }),
  currentFrame: 0,
  totalFrames: 0,
  progress: 0,
  elapsedSeconds: 0,
  uploadProgress: 0,
  setUploadProgress: (uploadProgress) => set({ uploadProgress }),

  liveStats: initialLiveStats,
  thumbnail: null,

  /* ── Events ── */
  events: [],
  addEvent: (e) =>
    set((s) => ({
      events: [
        { ...e, id: eventIdCounter++, run_id: s.activeRunId ?? 0 } as VehicleEvent,
        ...s.events,
      ].slice(0, 5000), // cap to 5000 in-memory
    })),
  clearEvents: () => set({ events: [] }),

  /* ── Frame update ── */
  applyFrameUpdate: (msg) =>
    set({
      currentFrame: msg.frameNumber,
      totalFrames: msg.totalFrames,
      progress: msg.progress,
      thumbnail: msg.thumbnail,
      liveStats: {
        activeTracks: msg.activeTracks,
        confirmedTracks: msg.confirmedTracks,
        totalDetections: msg.totalDetections,
        avgSpeed: msg.avgSpeed,
        maxSpeed: msg.maxSpeed,
        violations: msg.violations,
        vehicleTypes: msg.vehicleTypes,
        processingFps: msg.processingFps,
      },
    }),

  /* ── Config ── */
  config: DEFAULT_CONFIG,
  setConfig: (c) =>
    set((s) => ({
      config: { ...s.config, ...c },
    })),
  resetConfig: () => set({ config: DEFAULT_CONFIG }),

  /* ── Results ── */
  results: null,
  setResults: (results) => set({ results }),

  /* ── Reset ── */
  resetProcessing: () =>
    set({
      status: "idle",
      currentFrame: 0,
      totalFrames: 0,
      progress: 0,
      elapsedSeconds: 0,
      thumbnail: null,
      liveStats: initialLiveStats,
      events: [],
      results: null,
      activeRunId: null,
    }),
}));
