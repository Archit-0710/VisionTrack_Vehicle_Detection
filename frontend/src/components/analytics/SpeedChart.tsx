import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Cell,
} from "recharts";
import { useStore } from "@/store/useStore";
import { Zap } from "lucide-react";

export default function SpeedChart() {
  const { events, config } = useStore();
  const speedLimit = config.speedTrap.speedLimitKmph;

  // Build histogram buckets (10 km/h wide)
  const speeds = events.map((e) => e.speed_kmph).filter((s): s is number => s !== null);

  if (speeds.length === 0) {
    return (
      <div className="glass-card p-5 h-full flex flex-col">
        <div className="flex items-center gap-2 mb-4">
          <Zap size={14} className="text-yellow-400" />
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Speed Distribution</h3>
        </div>
        <div className="flex-1 flex items-center justify-center text-slate-600 text-sm">
          No speed data yet
        </div>
      </div>
    );
  }

  const maxSpeed = Math.max(...speeds, speedLimit + 20);
  const bucketSize = 10;
  const numBuckets = Math.ceil(maxSpeed / bucketSize) + 1;
  const buckets: { range: string; count: number; isViolation: boolean }[] = [];

  for (let i = 0; i < numBuckets; i++) {
    const lo = i * bucketSize;
    const hi = (i + 1) * bucketSize;
    const count = speeds.filter((s) => s >= lo && s < hi).length;
    buckets.push({ range: `${lo}`, count, isViolation: lo >= speedLimit });
  }

  return (
    <div className="glass-card p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap size={14} className="text-yellow-400" />
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Speed Distribution</h3>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 text-slate-400">
            <span className="w-2 h-2 rounded-sm inline-block" style={{ background: "#10b981" }} />
            Normal
          </span>
          <span className="flex items-center gap-1 text-slate-400">
            <span className="w-2 h-2 rounded-sm inline-block" style={{ background: "#ef4444" }} />
            Violation
          </span>
        </div>
      </div>

      <div className="flex-1 min-h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={buckets} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" vertical={false} />
            <XAxis dataKey="range" tick={{ fill: "#475569", fontSize: 10 }} axisLine={false} tickLine={false} label={{ value: "km/h", position: "insideRight", offset: 0, fill: "#475569", fontSize: 10 }} />
            <YAxis tick={{ fill: "#475569", fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: "#1a2236", border: "1px solid #1e3a5f", borderRadius: 8, color: "#f0f6ff", fontSize: 12 }}
              formatter={(v: number) => [`${v} vehicles`, "Count"]}
              labelFormatter={(l) => `${l}–${parseInt(l) + 10} km/h`}
            />
            <ReferenceLine x={speedLimit.toString()} stroke="#ef4444" strokeDasharray="4 2" label={{ value: `Limit ${speedLimit}`, fill: "#ef4444", fontSize: 10, position: "insideTopRight" }} />
            <Bar dataKey="count" radius={[3, 3, 0, 0]}>
              {buckets.map((b, i) => (
                <Cell key={i} fill={b.isViolation ? "#ef4444" : "#10b981"} opacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
