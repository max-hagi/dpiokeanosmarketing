import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Search, Users } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { Link } from "react-router-dom";
import LeadStatusBadge from "@/components/LeadStatusBadge";

export default function LeadList() {
  const [search, setSearch] = useState("");

  const { data: leads, isLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = leads?.filter(
    (l) =>
      l.full_name.toLowerCase().includes(search.toLowerCase()) ||
      l.email.toLowerCase().includes(search.toLowerCase()) ||
      (l.location && l.location.toLowerCase().includes(search.toLowerCase()))
  );

  const stats = {
    total: leads?.length ?? 0,
    complete: leads?.filter((l) => l.lead_status === "complete").length ?? 0,
    incomplete: leads?.filter((l) => l.lead_status === "incomplete").length ?? 0,
    sent: leads?.filter((l) => l.sent_to_conversation_agent).length ?? 0,
  };

  const exportCSV = () => {
    if (!leads) return;
    const headers = ["Date", "Name", "Email", "Phone", "Location", "Budget", "Timeline", "Source", "Status", "Sent to Agent"];
    const rows = leads.map((l) => [
      format(new Date(l.created_at), "yyyy-MM-dd HH:mm"),
      `"${l.full_name}"`,
      l.email,
      l.phone || "",
      l.location || "",
      l.budget || "",
      l.timeline || "",
      l.source || "",
      l.lead_status,
      l.sent_to_conversation_agent ? "Yes" : "No",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `okeanos-leads-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold">Leads</h1>
          <p className="text-muted-foreground mt-1">All captured lead inquiries</p>
        </div>
        <div className="flex gap-2">
          <Link to="/leads/capture">
            <Button className="gap-2">
              <Users className="h-4 w-4" />
              New Lead
            </Button>
          </Link>
          <Button variant="outline" onClick={exportCSV} className="gap-2" size="sm">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Leads", value: stats.total, color: "text-primary" },
          { label: "Complete", value: stats.complete, color: "text-success" },
          { label: "Incomplete", value: stats.incomplete, color: "text-warning" },
          { label: "Sent to Agent", value: stats.sent, color: "text-accent" },
        ].map((s) => (
          <div key={s.label} className="glass-card rounded-xl p-5">
            <p className="text-sm text-muted-foreground">{s.label}</p>
            <p className={`font-heading text-3xl font-bold mt-2 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, or location..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading...</div>
        ) : filtered && filtered.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Date</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Name</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Email</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Location</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Budget</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((lead) => (
                <tr key={lead.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                    {format(new Date(lead.created_at), "MMM d, yyyy")}
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/leads/${lead.id}`} className="text-sm font-medium hover:text-primary transition-colors">
                      {lead.full_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{lead.email}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{lead.location || "—"}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground capitalize">
                    {lead.budget ? lead.budget.replace(/_/g, " ").replace("k", "K") : "—"}
                  </td>
                  <td className="px-4 py-3"><LeadStatusBadge status={lead.lead_status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-12 text-center">
            <p className="text-muted-foreground mb-4">No leads captured yet.</p>
            <Link to="/leads/capture">
              <Button variant="outline" className="gap-2">
                <Users className="h-4 w-4" />
                Capture First Lead
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
