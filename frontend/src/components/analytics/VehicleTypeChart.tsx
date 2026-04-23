import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useStore } from "@/store/useStore";
import { Car } from "lucide-react";

const COLORS: Record<string, string> = {
  car: "#3b82f6",
  motorcycle: "#f59e0b",
  truck: "#8b5cf6",
  unknown: "#475569",
};

export default function VehicleTypeChart() {
  const { liveStats, results } = useStore();

  const vtCounts = results?.vehicleTypeCounts ?? liveStats.vehicleTypes;
  const data = Object.entries(vtCounts)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({
      name: k.charAt(0).toUpperCase() + k.slice(1),
      value: v,
      key: k,
    }));

  if (data.length === 0) {
    return (
      <div className="glass-card p-5 h-full flex flex-col">
        <div className="flex items-center gap-2 mb-4">
          <Car size={14} className="text-purple-400" />
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Vehicle Breakdown</h3>
        </div>
        <div className="flex-1 flex items-center justify-center text-slate-600 text-sm">No data yet</div>
      </div>
    );
  }

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="glass-card p-5 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <Car size={14} className="text-purple-400" />
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Vehicle Breakdown</h3>
      </div>
      <div className="flex-1 min-h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="55%"
              outerRadius="80%"
              dataKey="value"
              paddingAngle={3}
              stroke="none"
            >
              {data.map((entry) => (
                <Cell key={entry.key} fill={COLORS[entry.key] ?? "#475569"} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: "#1a2236", border: "1px solid #1e3a5f", borderRadius: 8, color: "#f0f6ff", fontSize: 12 }}
              formatter={(v: number, name: string) => [`${v} (${Math.round((v / total) * 100)}%)`, name]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      {/* Custom legend */}
      <div className="flex flex-col gap-1.5 mt-2">
        {data.map((d) => (
          <div key={d.key} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[d.key] ?? "#475569" }} />
              <span className="text-xs text-slate-400">{d.name}</span>
            </div>
            <span className="text-xs font-mono text-slate-300">
              {d.value} <span className="text-slate-600">({Math.round((d.value / total) * 100)}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
