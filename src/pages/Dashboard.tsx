import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { PenSquare, FileText, Image, Clock, CheckCircle2, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/StatusBadge";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: requests, isLoading } = useQuery({
    queryKey: ["content-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_requests")
        .select("*, generated_content(*)")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [totalRes, reviewRes, approvedRes, postedRes] = await Promise.all([
        supabase.from("content_requests").select("id", { count: "exact", head: true }),
        supabase.from("content_requests").select("id", { count: "exact", head: true }).eq("status", "review"),
        supabase.from("content_requests").select("id", { count: "exact", head: true }).eq("status", "approved"),
        supabase.from("content_requests").select("id", { count: "exact", head: true }).eq("status", "posted"),
      ]);
      return {
        total: totalRes.count ?? 0,
        review: reviewRes.count ?? 0,
        approved: approvedRes.count ?? 0,
        posted: postedRes.count ?? 0,
      };
    },
  });

  const statCards = [
    { label: "Total Requests", value: stats?.total ?? 0, icon: FileText, gradient: "from-primary/10 to-primary/5", iconColor: "text-primary" },
    { label: "Awaiting Review", value: stats?.review ?? 0, icon: Clock, gradient: "from-warning/10 to-warning/5", iconColor: "text-warning" },
    { label: "Approved", value: stats?.approved ?? 0, icon: CheckCircle2, gradient: "from-success/10 to-success/5", iconColor: "text-success" },
    { label: "Posted", value: stats?.posted ?? 0, icon: TrendingUp, gradient: "from-accent/10 to-accent/5", iconColor: "text-accent" },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Your marketing content at a glance</p>
        </div>
        <Link to="/create">
          <Button className="gap-2 shadow-md hover:shadow-lg transition-shadow">
            <PenSquare className="h-4 w-4" />
            Create Content
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <div key={stat.label} className={`glass-card rounded-2xl p-5 bg-gradient-to-br ${stat.gradient} hover:shadow-md transition-shadow duration-300`}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
              <div className={`h-9 w-9 rounded-xl bg-card flex items-center justify-center shadow-sm ${stat.iconColor}`}>
                <stat.icon className="h-4 w-4" />
              </div>
            </div>
            <p className="font-heading text-3xl font-bold mt-3 tracking-tight">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="glass-card rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-heading text-lg font-semibold tracking-tight">Recent Content</h2>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading...</div>
        ) : requests && requests.length > 0 ? (
          <div className="divide-y divide-border">
            {requests.map((req) => (
              <Link
                key={req.id}
                to={`/review/${req.id}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{req.prompt}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {req.content_type.replace("_", " ")} · {format(new Date(req.created_at), "MMM d, yyyy h:mm a")}
                  </p>
                </div>
                <StatusBadge status={req.status} />
              </Link>
            ))}
          </div>
        ) : (
          <div className="p-16 text-center">
            <div className="flex justify-center mb-4">
              <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center">
                <PenSquare className="h-6 w-6 text-muted-foreground" />
              </div>
            </div>
            <p className="text-muted-foreground mb-4">No content yet. Start creating!</p>
            <Link to="/create">
              <Button variant="outline" className="gap-2">
                <PenSquare className="h-4 w-4" />
                Create Your First Content
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
