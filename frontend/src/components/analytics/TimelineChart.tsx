import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { useStore } from "@/store/useStore";
import { TrendingUp } from "lucide-react";

export default function TimelineChart() {
  const { events } = useStore();

  if (events.length === 0) {
    return (
      <div className="glass-card p-5 h-full flex flex-col">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={14} className="text-blue-400" />
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Speed Timeline</h3>
        </div>
        <div className="flex-1 flex items-center justify-center text-slate-600 text-sm">
          No data yet
        </div>
      </div>
    );
  }

  // Group events by 5-second windows
  const bucketSize = 5;
  const maxTs = Math.max(...events.map((e) => e.timestamp_seconds ?? 0));
  const numBuckets = Math.ceil(maxTs / bucketSize) + 1;
  const timeline: { time: string; avgSpeed: number; count: number; violations: number }[] = [];

  for (let i = 0; i < numBuckets; i++) {
    const lo = i * bucketSize;
    const hi = (i + 1) * bucketSize;
    const bucket = events.filter(
      (e) => (e.timestamp_seconds ?? 0) >= lo && (e.timestamp_seconds ?? 0) < hi
    );
    const speeds = bucket.map((e) => e.speed_kmph).filter((s): s is number => s !== null);
    const avg = speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;
    const viols = bucket.filter((e) => e.is_violation).length;
    timeline.push({
      time: `${lo}s`,
      avgSpeed: Math.round(avg * 10) / 10,
      count: bucket.length,
      violations: viols,
    });
  }

  return (
    <div className="glass-card p-5 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp size={14} className="text-blue-400" />
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Speed Timeline</h3>
      </div>

      <div className="flex-1 min-h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={timeline} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
            <XAxis dataKey="time" tick={{ fill: "#475569", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#475569", fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: "#1a2236", border: "1px solid #1e3a5f", borderRadius: 8, color: "#f0f6ff", fontSize: 12 }}
            />
            <Line
              type="monotone"
              dataKey="avgSpeed"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              name="Avg Speed (km/h)"
              activeDot={{ r: 4, fill: "#3b82f6" }}
            />
            <Line
              type="monotone"
              dataKey="violations"
              stroke="#ef4444"
              strokeWidth={1.5}
              strokeDasharray="4 2"
              dot={false}
              name="Violations"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
