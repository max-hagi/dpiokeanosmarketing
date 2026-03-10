import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import StatusBadge from "@/components/StatusBadge";
import { Download, Search } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { Link } from "react-router-dom";

export default function ContentHistory() {
  const [search, setSearch] = useState("");

  const { data: requests, isLoading } = useQuery({
    queryKey: ["all-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_requests")
        .select("*, generated_content(id, version, is_approved, target_platform, image_url)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: auditLogs } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const filtered = requests?.filter(
    (r) =>
      r.prompt.toLowerCase().includes(search.toLowerCase()) ||
      r.content_type.includes(search.toLowerCase())
  );

  const exportCSV = () => {
    if (!requests) return;

    const headers = ["Date", "Prompt", "Type", "Audience", "Status", "Versions", "Platform"];
    const rows = requests.map((r) => [
      format(new Date(r.created_at), "yyyy-MM-dd HH:mm"),
      `"${r.prompt.replace(/"/g, '""')}"`,
      r.content_type,
      r.target_audience || "",
      r.status,
      r.generated_content?.length ?? 0,
      r.generated_content?.find((c: any) => c.is_approved)?.target_platform || "",
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `okeanos-content-history-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportAuditCSV = () => {
    if (!auditLogs) return;

    const headers = ["Timestamp", "Action", "Request ID", "Content ID", "Details"];
    const rows = auditLogs.map((log) => [
      format(new Date(log.created_at), "yyyy-MM-dd HH:mm:ss"),
      log.action,
      log.request_id || "",
      log.content_id || "",
      `"${JSON.stringify(log.details || {}).replace(/"/g, '""')}"`,
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `okeanos-audit-log-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Content History</h1>
          <p className="text-muted-foreground mt-1">Full log of all generated content and actions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV} className="gap-2" size="sm">
            <Download className="h-4 w-4" />
            Export Content
          </Button>
          <Button variant="outline" onClick={exportAuditCSV} className="gap-2" size="sm">
            <Download className="h-4 w-4" />
            Export Audit Log
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by prompt or content type..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="glass-card rounded-2xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading...</div>
        ) : filtered && filtered.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Date</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Prompt</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Type</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Versions</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((req) => (
                <tr key={req.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                    {format(new Date(req.created_at), "MMM d, yyyy")}
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/review/${req.id}`} className="text-sm font-medium hover:text-primary transition-colors truncate block max-w-md">
                      {req.prompt}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm capitalize">{req.content_type.replace("_", " ")}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{req.generated_content?.length ?? 0}</td>
                  <td className="px-4 py-3"><StatusBadge status={req.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-8 text-center text-muted-foreground">No content history found.</div>
        )}
      </div>
    </div>
  );
}
