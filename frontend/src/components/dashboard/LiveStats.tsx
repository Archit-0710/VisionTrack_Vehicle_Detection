import { Car, Zap, AlertTriangle, TrendingUp, Activity, Users } from "lucide-react";
import { useStore } from "@/store/useStore";

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon: React.ReactNode;
  color: string;
  glow?: string;
  live?: boolean;
}

function StatCard({ label, value, unit, icon, color, glow, live }: StatCardProps) {
  return (
    <div
      className={`glass-card p-4 transition-all duration-300 ${glow ? glow : ""}`}
      style={{ borderColor: "var(--border)" }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg`} style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
          <div style={{ color }}>{icon}</div>
        </div>
        {live && (
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#10b981", boxShadow: "0 0 8px #10b981" }} />
        )}
      </div>
      <div className="space-y-0.5">
        <div className="flex items-end gap-1.5">
          <span className="text-2xl font-bold text-slate-100 font-mono tabular-nums">{value}</span>
          {unit && <span className="text-xs text-slate-500 mb-1">{unit}</span>}
        </div>
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</p>
      </div>
    </div>
  );
}

export default function LiveStats() {
  const { liveStats, status } = useStore();
  const live = status === "processing";
  const { activeTracks, confirmedTracks, totalDetections, avgSpeed, maxSpeed, violations, vehicleTypes, processingFps } = liveStats;

  const carCount = vehicleTypes.car ?? 0;
  const motoCount = vehicleTypes.motorcycle ?? 0;
  const truckCount = vehicleTypes.truck ?? 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Activity size={14} className="text-blue-400" />
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Live Metrics</h3>
        {live && <span className="text-xs text-green-400 stat-live">Live</span>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Active Tracks"
          value={confirmedTracks}
          icon={<Users size={14} />}
          color="#3b82f6"
          live={live}
        />
        <StatCard
          label="Detections"
          value={totalDetections}
          icon={<Car size={14} />}
          color="#8b5cf6"
          live={live}
        />
        <StatCard
          label="Avg Speed"
          value={avgSpeed.toFixed(1)}
          unit="km/h"
          icon={<Zap size={14} />}
          color="#10b981"
          live={live}
        />
        <StatCard
          label="Max Speed"
          value={maxSpeed.toFixed(1)}
          unit="km/h"
          icon={<TrendingUp size={14} />}
          color="#f59e0b"
          live={live}
        />
        <StatCard
          label="Violations"
          value={violations}
          icon={<AlertTriangle size={14} />}
          color={violations > 0 ? "#ef4444" : "#6b7280"}
          glow={violations > 0 ? "glow-red" : undefined}
          live={live}
        />
        <StatCard
          label="Processing FPS"
          value={processingFps.toFixed(1)}
          unit="fps"
          icon={<Activity size={14} />}
          color="#06b6d4"
          live={live}
        />
      </div>

      {/* Vehicle type mini-breakdown */}
      <div className="glass-card p-4">
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-3">Vehicle Types</p>
        <div className="space-y-2">
          {[
            { label: "Cars",        count: carCount,   color: "#3b82f6" },
            { label: "Motorcycles", count: motoCount,  color: "#f59e0b" },
            { label: "Trucks/Buses",count: truckCount, color: "#8b5cf6" },
          ].map((vt) => {
            const total = carCount + motoCount + truckCount || 1;
            const pct = Math.round((vt.count / total) * 100);
            return (
              <div key={vt.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">{vt.label}</span>
                  <span className="text-slate-300 font-mono">{vt.count}</span>
                </div>
                <div className="h-1.5 rounded-full" style={{ background: "var(--border)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, background: vt.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
