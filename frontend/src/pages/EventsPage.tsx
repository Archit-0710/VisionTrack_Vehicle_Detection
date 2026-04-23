import EventTable from "@/components/events/EventTable";
import { List } from "lucide-react";
import { useStore } from "@/store/useStore";

export default function EventsPage() {
  const { events } = useStore();
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <List size={16} className="text-blue-400" />
        <h1 className="text-base font-semibold text-slate-200">Event Log</h1>
        <span className="badge badge-blue ml-1">{events.length}</span>
      </div>
      <div style={{ maxHeight: "calc(100vh - 200px)", overflow: "hidden" }}>
        <EventTable />
      </div>
    </div>
  );
}
