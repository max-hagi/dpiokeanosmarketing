import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Download, Search, Users, UserCheck, AlertCircle, MessageCircle, Brain } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import LeadStatusBadge from "@/components/LeadStatusBadge";
import LeadStageBadge from "@/components/LeadStageBadge";

export default function LeadList() {
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const { data: leads, isLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const { data, error } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: crmRecords, isLoading: crmLoading } = useQuery({
    queryKey: ["crm-records-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("crm_records").select("*").order("created_at", { ascending: false });
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

  const filteredCrm = crmRecords?.filter(r =>
    r.full_name.toLowerCase().includes(search.toLowerCase()) ||
    r.email_address.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: leads?.length ?? 0,
    complete: leads?.filter((l) => l.lead_status === "complete").length ?? 0,
    incomplete: leads?.filter((l) => l.lead_status === "incomplete").length ?? 0,
    crm: crmRecords?.length ?? 0,
  };

  const exportCSV = () => {
    if (!leads) return;
    const headers = ["Date", "Name", "Email", "Phone", "Location", "Budget", "Timeline", "Source", "Stage", "Segment", "Status"];
    const rows = leads.map((l) => [
      format(new Date(l.created_at), "yyyy-MM-dd HH:mm"),
      `"${l.full_name}"`, l.email, l.phone || "", l.location || "",
      l.budget || "", l.timeline || "", l.source || "",
      l.lead_stage, l.customer_segment || "", l.lead_status,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `okeanos-leads-${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const statCards = [
    { label: "Total Leads", value: stats.total, icon: Users, gradient: "from-primary/10 to-primary/5", iconColor: "text-primary" },
    { label: "Complete", value: stats.complete, icon: UserCheck, gradient: "from-success/10 to-success/5", iconColor: "text-success" },
    { label: "Incomplete", value: stats.incomplete, icon: AlertCircle, gradient: "from-warning/10 to-warning/5", iconColor: "text-warning" },
    { label: "CRM Records", value: stats.crm, icon: Brain, gradient: "from-accent/10 to-accent/5", iconColor: "text-accent" },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Leads</h1>
          <p className="text-muted-foreground mt-1">All captured lead inquiries and CRM records</p>
        </div>
        <div className="flex gap-2">
          <Link to="/leads/pipeline"><Button variant="outline" className="gap-2">Pipeline View</Button></Link>
          <Link to="/leads/capture"><Button className="gap-2 shadow-md"><Users className="h-4 w-4" /> New Lead</Button></Link>
          <Button variant="outline" onClick={exportCSV} className="gap-2" size="sm"><Download className="h-4 w-4" /> Export CSV</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <div key={s.label} className={`glass-card rounded-2xl p-5 bg-gradient-to-br ${s.gradient} hover:shadow-md transition-shadow duration-300`}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">{s.label}</p>
              <div className={`h-9 w-9 rounded-xl bg-card flex items-center justify-center shadow-sm ${s.iconColor}`}>
                <s.icon className="h-4 w-4" />
              </div>
            </div>
            <p className="font-heading text-3xl font-bold mt-3 tracking-tight">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by name, email, or location..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-11 rounded-xl" />
      </div>

      <Tabs defaultValue="leads" className="space-y-4">
        <TabsList>
          <TabsTrigger value="leads">All Leads</TabsTrigger>
          <TabsTrigger value="crm">CRM Records</TabsTrigger>
        </TabsList>

        <TabsContent value="leads">
          <div className="glass-card rounded-2xl overflow-hidden shadow-sm">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading...</div>
            ) : filtered && filtered.length > 0 ? (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3.5 uppercase tracking-wider">Date</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3.5 uppercase tracking-wider">Name</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3.5 uppercase tracking-wider">Location</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3.5 uppercase tracking-wider">Budget</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3.5 uppercase tracking-wider">Stage</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3.5 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((lead) => (
                    <tr key={lead.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3.5 text-sm text-muted-foreground whitespace-nowrap">{format(new Date(lead.created_at), "MMM d, yyyy")}</td>
                      <td className="px-5 py-3.5">
                        <Link to={`/leads/${lead.id}`} className="text-sm font-medium hover:text-primary transition-colors">{lead.full_name}</Link>
                        <p className="text-xs text-muted-foreground mt-0.5">{lead.email}</p>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-muted-foreground">{lead.location || "—"}</td>
                      <td className="px-5 py-3.5 text-sm text-muted-foreground capitalize">{lead.budget ? lead.budget.replace(/_/g, " ").replace("k", "K") : "—"}</td>
                      <td className="px-5 py-3.5"><LeadStageBadge stage={lead.lead_stage} /></td>
                      <td className="px-5 py-3.5"><LeadStatusBadge status={lead.lead_status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-16 text-center">
                <div className="flex justify-center mb-4">
                  <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center"><Users className="h-6 w-6 text-muted-foreground" /></div>
                </div>
                <p className="text-muted-foreground mb-4">No leads captured yet.</p>
                <Link to="/leads/capture"><Button variant="outline" className="gap-2"><Users className="h-4 w-4" /> Capture First Lead</Button></Link>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="crm">
          <div className="glass-card rounded-2xl overflow-hidden shadow-sm">
            {crmLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading...</div>
            ) : filteredCrm && filteredCrm.length > 0 ? (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3.5 uppercase tracking-wider">Customer</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3.5 uppercase tracking-wider">Score</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3.5 uppercase tracking-wider">Segment</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3.5 uppercase tracking-wider">Routing</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3.5 uppercase tracking-wider">Sequence</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3.5 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredCrm.map(r => (
                    <tr key={r.id} className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate(`/leads/${r.lead_id}`)}>
                      <td className="px-5 py-3.5">
                        <p className="text-sm font-medium">{r.full_name}</p>
                        <p className="text-xs text-muted-foreground">{r.customer_id}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`text-sm font-bold ${(r.qualification_score || 0) >= 70 ? "text-success" : (r.qualification_score || 0) >= 50 ? "text-warning" : "text-destructive"}`}>
                          {r.qualification_score}/100
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sm">{r.customer_segment}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          r.routing_decision === "QUALIFIED" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                        }`}>{r.routing_decision}</span>
                      </td>
                      <td className="px-5 py-3.5 text-sm font-mono">{r.follow_up_sequence ? `Seq ${r.follow_up_sequence}` : "—"}</td>
                      <td className="px-5 py-3.5">
                        {r.is_won === true && <span className="text-xs font-semibold text-success">WON</span>}
                        {r.is_won === false && <span className="text-xs font-semibold text-destructive">LOST</span>}
                        {r.is_won === null && <span className="text-xs text-muted-foreground">Open</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-16 text-center">
                <div className="flex justify-center mb-4">
                  <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center"><Brain className="h-6 w-6 text-muted-foreground" /></div>
                </div>
                <p className="text-muted-foreground mb-2">No CRM records yet.</p>
                <p className="text-xs text-muted-foreground">CRM records are created automatically when you view a qualified lead.</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
