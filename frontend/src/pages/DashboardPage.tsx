import VideoUploader from "@/components/upload/VideoUploader";
import VideoList from "@/components/upload/VideoList";
import ProcessingControl from "@/components/dashboard/ProcessingControl";
import LiveStats from "@/components/dashboard/LiveStats";
import VideoPlayer from "@/components/dashboard/VideoPlayer";
import ProgressBar from "@/components/dashboard/ProgressBar";
import SpeedChart from "@/components/analytics/SpeedChart";
import EventTable from "@/components/events/EventTable";
import VehicleTypeChart from "@/components/analytics/VehicleTypeChart";
import TimelineChart from "@/components/analytics/TimelineChart";
import { useStore } from "@/store/useStore";
import { AlertTriangle, TrendingUp, Car } from "lucide-react";

function SummaryBanner() {
  const { results, status } = useStore();
  if (!results || status !== "completed") return null;
  return (
    <div className="glass-card p-4 glow-blue border-blue-500/30 animate-slide-up"
      style={{ borderColor: "rgba(59,130,246,0.3)" }}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Events", value: results.totalEvents, icon: <Car size={14} className="text-blue-400" />, color: "#3b82f6" },
          { label: "Violations", value: results.totalViolations, icon: <AlertTriangle size={14} className="text-red-400" />, color: "#ef4444" },
          { label: "Avg Speed", value: `${results.avgSpeed.toFixed(1)} km/h`, icon: <TrendingUp size={14} className="text-green-400" />, color: "#10b981" },
          { label: "Max Speed", value: `${results.maxSpeed.toFixed(1)} km/h`, icon: <TrendingUp size={14} className="text-orange-400" />, color: "#f59e0b" },
        ].map((stat) => (
          <div key={stat.label} className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ background: `${stat.color}18`, border: `1px solid ${stat.color}30` }}>
              {stat.icon}
            </div>
            <div>
              <p className="text-lg font-bold font-mono text-slate-100">{stat.value}</p>
              <p className="text-xs text-slate-500 uppercase tracking-wide">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { status } = useStore();
  const hasActivity = status !== "idle";

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Completed summary */}
      <SummaryBanner />

      {/* Top grid: Upload + Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <VideoUploader />
        <VideoList />
      </div>

      {/* Processing Controls + Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ProcessingControl />
        <ProgressBar />
      </div>

      {/* Main content: Video player + Live stats */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <VideoPlayer />
        </div>
        <div>
          <LiveStats />
        </div>
      </div>

      {/* Charts row */}
      {hasActivity && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ minHeight: 260 }}>
          <div className="lg:col-span-2">
            <SpeedChart />
          </div>
          <div>
            <VehicleTypeChart />
          </div>
        </div>
      )}

      {/* Event table */}
      <EventTable />
    </div>
  );
}
