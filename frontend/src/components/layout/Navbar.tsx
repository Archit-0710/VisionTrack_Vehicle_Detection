import { Activity, Car, Settings, Download, ChevronDown } from "lucide-react";
import { useStore } from "@/store/useStore";
import type { AppTab } from "@/types";

const TABS: { id: AppTab; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "analytics", label: "Analytics" },
  { id: "events",    label: "Events"    },
  { id: "config",    label: "Config"    },
];

const STATUS_MAP: Record<string, { label: string; color: string; pulse: boolean }> = {
  idle:       { label: "Idle",       color: "text-slate-400", pulse: false },
  uploading:  { label: "Uploading…", color: "text-blue-400",  pulse: true  },
  processing: { label: "Processing", color: "text-green-400", pulse: true  },
  completed:  { label: "Completed",  color: "text-purple-400",pulse: false },
  cancelled:  { label: "Cancelled",  color: "text-orange-400",pulse: false },
  error:      { label: "Error",      color: "text-red-400",   pulse: false },
};

export default function Navbar() {
  const { activeTab, setActiveTab, status, activeRunId } = useStore();
  const sm = STATUS_MAP[status] ?? STATUS_MAP.idle;

  return (
    <header className="fixed top-0 left-0 right-0 z-50"
      style={{ background: "rgba(10,15,30,0.92)", borderBottom: "1px solid var(--border)", backdropFilter: "blur(20px)" }}>
      <div className="flex items-center justify-between px-6 h-14 max-w-[1600px] mx-auto">

        {/* ── Logo ── */}
        <div className="flex items-center gap-2 min-w-[200px]">
          <div className="p-1.5 rounded-lg" style={{ background: "var(--glow-blue)", border: "1px solid rgba(59,130,246,0.3)" }}>
            <Car size={18} className="text-blue-400" />
          </div>
          <div>
            <span className="font-bold text-sm gradient-text">VisionTrack</span>
            <span className="text-slate-500 text-xs ml-1.5 hidden md:inline">Vehicle Detection</span>
          </div>
        </div>

        {/* ── Tab Navigation ── */}
        <nav className="flex items-center gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                activeTab === t.id
                  ? "bg-blue-600/20 text-blue-300 border border-blue-500/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {/* ── Status indicator ── */}
        <div className="flex items-center gap-4 min-w-[200px] justify-end">
          <div className="flex items-center gap-2 text-xs">
            {sm.pulse && (
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse-slow" />
            )}
            <span className={sm.color + " font-medium"}>{sm.label}</span>
            {activeRunId && (
              <span className="text-slate-500">#{activeRunId}</span>
            )}
          </div>
          <Activity size={16} className="text-slate-500" />
        </div>
      </div>
    </header>
  );
}
