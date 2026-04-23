import Navbar from "@/components/layout/Navbar";
import DashboardPage from "@/pages/DashboardPage";
import AnalyticsPage from "@/pages/AnalyticsPage";
import EventsPage from "@/pages/EventsPage";
import ConfigPage from "@/pages/ConfigPage";
import { useStore } from "@/store/useStore";

export default function App() {
  const { activeTab } = useStore();

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-app)" }}>
      <Navbar />

      {/* Main content — offset for fixed navbar */}
      <main className="max-w-[1600px] mx-auto px-4 md:px-6 pt-20 pb-10">
        {activeTab === "dashboard"  && <DashboardPage />}
        {activeTab === "analytics"  && <AnalyticsPage />}
        {activeTab === "events"     && <EventsPage />}
        {activeTab === "config"     && <ConfigPage />}
      </main>
    </div>
  );
}
