import { useSearchParams } from "react-router-dom";
import CreateContent from "./CreateContent";
import ContentHistory from "./ContentHistory";
import WeeklyPlanner from "./WeeklyPlanner";

const tabs = [
  { key: "generate", label: "Generate Content" },
  { key: "history", label: "Content History" },
  { key: "planner", label: "Weekly Planner" },
];

export default function Marketing() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "generate";
  const setTab = (tab: string) => setSearchParams({ tab });

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">Marketing</h1>
        <p className="text-muted-foreground mt-1">Content generation and management</p>
      </div>

      <div className="border-b border-border">
        <div className="flex gap-6">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "generate" && <CreateContent />}
      {activeTab === "history" && <ContentHistory />}
      {activeTab === "planner" && <WeeklyPlanner />}
    </div>
  );
}
