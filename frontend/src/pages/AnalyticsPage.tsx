import SpeedChart from "@/components/analytics/SpeedChart";
import TimelineChart from "@/components/analytics/TimelineChart";
import VehicleTypeChart from "@/components/analytics/VehicleTypeChart";
import { useStore } from "@/store/useStore";
import { BarChart2, AlertTriangle, Car, TrendingUp, Zap, Activity } from "lucide-react";

function StatRow() {
  const { results, liveStats, status } = useStore();
  const data = results ?? {
    totalEvents: liveStats.totalDetections,
    totalViolations: liveStats.violations,
    avgSpeed: liveStats.avgSpeed,
    maxSpeed: liveStats.maxSpeed,
    vehicleTypeCounts: liveStats.vehicleTypes,
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
      {[
        { label: "Total Detected", value: data.totalEvents, icon: <Car size={18} />, color: "#3b82f6" },
        { label: "Violations", value: data.totalViolations, icon: <AlertTriangle size={18} />, color: "#ef4444" },
        { label: "Avg Speed", value: `${data.avgSpeed.toFixed(1)} km/h`, icon: <Zap size={18} />, color: "#10b981" },
        { label: "Max Speed", value: `${data.maxSpeed.toFixed(1)} km/h`, icon: <TrendingUp size={18} />, color: "#f59e0b" },
      ].map((s) => (
        <div key={s.label} className="glass-card p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg flex-shrink-0" style={{ background: `${s.color}18`, border: `1px solid ${s.color}30`, color: s.color }}>
            {s.icon}
          </div>
          <div>
            <p className="text-xl font-bold font-mono text-slate-100">{s.value}</p>
            <p className="text-xs text-slate-500 uppercase tracking-wide mt-0.5">{s.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const { events } = useStore();

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <BarChart2 size={16} className="text-blue-400" />
        <h1 className="text-base font-semibold text-slate-200">Analytics</h1>
        <span className="badge badge-blue ml-1">{events.length} events</span>
      </div>

      <StatRow />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ minHeight: 280 }}>
        <div className="lg:col-span-2">
          <SpeedChart />
        </div>
        <div>
          <VehicleTypeChart />
        </div>
      </div>

      <div style={{ minHeight: 260 }}>
        <TimelineChart />
      </div>
    </div>
  );
}
