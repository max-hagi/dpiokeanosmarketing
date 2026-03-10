import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { ArrowLeft, User, DollarSign, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import LeadStatusBadge from "@/components/LeadStatusBadge";

const stages = [
  { value: "inquiry", label: "Inquiry", color: "from-primary/20 to-primary/5 border-t-primary" },
  { value: "qualified", label: "Qualified", color: "from-warning/20 to-warning/5 border-t-warning" },
  { value: "quoted", label: "Quoted", color: "from-accent/20 to-accent/5 border-t-accent" },
  { value: "sold", label: "Sold", color: "from-success/20 to-success/5 border-t-success" },
  { value: "installed", label: "Installed", color: "from-secondary-foreground/10 to-secondary-foreground/5 border-t-secondary-foreground" },
  { value: "retention", label: "Retention", color: "from-primary/15 to-primary/5 border-t-primary" },
];

const budgetLabels: Record<string, string> = {
  under_30k: "<$30K",
  "30k_50k": "$30-50K",
  "50k_80k": "$50-80K",
  "80k_plus": "$80K+",
};

export default function LeadPipeline() {
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

  const getLeadsByStage = (stage: string) => leads?.filter((l) => l.lead_stage === stage) || [];

  return (
    <div className="max-w-full mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Link to="/leads"><Button variant="ghost" size="icon" className="rounded-xl"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Pipeline</h1>
          <p className="text-muted-foreground mt-1">
            {leads?.length ?? 0} leads across {stages.length} stages
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground">Loading pipeline...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {stages.map((stage) => {
            const stageLeads = getLeadsByStage(stage.value);
            return (
              <div key={stage.value} className="space-y-3">
                <div className={`glass-card rounded-2xl border-t-[3px] bg-gradient-to-b ${stage.color} p-4`}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-heading text-sm font-semibold">{stage.label}</h3>
                    <span className="text-xs font-bold bg-card rounded-full px-2.5 py-0.5 shadow-sm">{stageLeads.length}</span>
                  </div>
                </div>

                <div className="space-y-2 min-h-[200px]">
                  {stageLeads.map((lead) => (
                    <Link key={lead.id} to={`/leads/${lead.id}`}>
                      <div className="glass-card rounded-xl p-3.5 hover:border-primary/40 hover:shadow-md transition-all duration-200 cursor-pointer space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="h-3 w-3 text-primary" />
                            </div>
                            <p className="text-sm font-medium truncate">{lead.full_name}</p>
                          </div>
                          <LeadStatusBadge status={lead.lead_status} />
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {lead.location && (
                            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{lead.location}</span>
                          )}
                          {lead.budget && (
                            <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />{budgetLabels[lead.budget] || lead.budget}</span>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                  {stageLeads.length === 0 && (
                    <div className="rounded-xl border-2 border-dashed border-border/50 p-6 text-center text-xs text-muted-foreground/60">
                      No leads
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
