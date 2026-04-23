import { useState, useMemo } from "react";
import { AlertTriangle, CheckCircle, ArrowUpDown, Download, ExternalLink } from "lucide-react";
import { useStore } from "@/store/useStore";
import { downloadCSV, downloadJSON } from "@/services/api";
import type { VehicleEvent } from "@/types";

type SortKey = "frame_number" | "speed_kmph" | "timestamp_seconds";

function typeClass(t: string | null) {
  if (t === "car") return "badge badge-blue";
  if (t === "motorcycle") return "badge badge-orange";
  if (t === "truck") return "badge badge-purple";
  return "badge badge-green";
}

export default function EventTable() {
  const { events, activeRunId } = useStore();

  const [filterType, setFilterType] = useState<string>("all");
  const [filterViolation, setFilterViolation] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("frame_number");
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const filtered = useMemo(() => {
    let arr = [...events];
    if (filterType !== "all") arr = arr.filter((e) => e.vehicle_type === filterType);
    if (filterViolation === "yes") arr = arr.filter((e) => e.is_violation);
    if (filterViolation === "no") arr = arr.filter((e) => !e.is_violation);
    if (search) arr = arr.filter((e) => String(e.track_id).includes(search));
    arr.sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return arr;
  }, [events, filterType, filterViolation, search, sortKey, sortAsc]);

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const sort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((a) => !a);
    else { setSortKey(key); setSortAsc(false); }
  };

  return (
    <div className="glass-card flex flex-col overflow-hidden" style={{ maxHeight: "420px" }}>
      {/* Header + controls */}
      <div className="flex items-center justify-between px-5 py-3 border-b flex-shrink-0" style={{ borderColor: "var(--border)" }}>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
          Event Log <span className="text-slate-600 ml-1 font-mono">{filtered.length}</span>
        </h3>
        <div className="flex items-center gap-3">
          {/* Filters */}
          <select value={filterType} onChange={(e) => { setFilterType(e.target.value); setPage(0); }}
            className="form-input py-1 px-2 text-xs w-28" style={{ paddingTop: "4px", paddingBottom: "4px" }}>
            <option value="all">All Types</option>
            <option value="car">Cars</option>
            <option value="motorcycle">Motorcycles</option>
            <option value="truck">Trucks</option>
          </select>
          <select value={filterViolation} onChange={(e) => { setFilterViolation(e.target.value); setPage(0); }}
            className="form-input py-1 px-2 text-xs w-28" style={{ paddingTop: "4px", paddingBottom: "4px" }}>
            <option value="all">All</option>
            <option value="yes">Violations</option>
            <option value="no">No Violation</option>
          </select>
          <input
            type="text"
            placeholder="Track ID…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="form-input py-1 px-2 text-xs w-24"
            style={{ paddingTop: "4px", paddingBottom: "4px" }}
          />
          {/* Downloads */}
          {activeRunId && (
            <div className="flex gap-1">
              <button className="btn btn-ghost py-1 px-2 text-xs" onClick={() => downloadCSV(activeRunId)}>
                <Download size={11} />CSV
              </button>
              <button className="btn btn-ghost py-1 px-2 text-xs" onClick={() => downloadJSON(activeRunId)}>
                <Download size={11} />JSON
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-auto flex-1">
        <table className="data-table">
          <thead>
            <tr>
              <th>
                <button onClick={() => sort("frame_number")} className="flex items-center gap-1 hover:text-slate-200">
                  Frame <ArrowUpDown size={10} />
                </button>
              </th>
              <th>
                <button onClick={() => sort("timestamp_seconds")} className="flex items-center gap-1 hover:text-slate-200">
                  Time <ArrowUpDown size={10} />
                </button>
              </th>
              <th>Track ID</th>
              <th>Type</th>
              <th>
                <button onClick={() => sort("speed_kmph")} className="flex items-center gap-1 hover:text-slate-200">
                  Speed <ArrowUpDown size={10} />
                </button>
              </th>
              <th>Violation</th>
              <th>Confidence</th>
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center text-slate-600 py-8">
                  No events{events.length === 0 ? " — start processing to populate" : " matching filters"}
                </td>
              </tr>
            ) : (
              paged.map((ev) => (
                <tr key={ev.id} className="animate-fade-in">
                  <td className="font-mono text-xs text-slate-300">{ev.frame_number?.toLocaleString() ?? "—"}</td>
                  <td className="font-mono text-xs text-slate-400">{ev.timestamp_seconds?.toFixed(1) ?? "—"}s</td>
                  <td className="font-mono text-xs">
                    <span className="badge badge-blue px-1.5 py-0.5">#{ev.track_id ?? "?"}</span>
                  </td>
                  <td><span className={typeClass(ev.vehicle_type)}>{ev.vehicle_type ?? "?"}</span></td>
                  <td>
                    <span className={`font-mono text-sm font-semibold ${ev.is_violation ? "text-red-400" : "text-green-400"}`}>
                      {ev.speed_kmph?.toFixed(1) ?? "—"}
                    </span>
                    <span className="text-slate-600 text-xs ml-1">km/h</span>
                  </td>
                  <td>
                    {ev.is_violation ? (
                      <span className="flex items-center gap-1 badge badge-red">
                        <AlertTriangle size={10} />YES
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 badge badge-green">
                        <CheckCircle size={10} />NO
                      </span>
                    )}
                  </td>
                  <td className="text-xs text-slate-500">
                    {ev.vehicle_confidence ? `${(ev.vehicle_confidence * 100).toFixed(0)}%` : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-2 border-t flex-shrink-0 text-xs text-slate-500" style={{ borderColor: "var(--border)" }}>
          <span>Page {page + 1} of {totalPages} ({filtered.length} events)</span>
          <div className="flex gap-2">
            <button className="btn btn-ghost py-1 px-2 text-xs" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
              Prev
            </button>
            <button className="btn btn-ghost py-1 px-2 text-xs" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
