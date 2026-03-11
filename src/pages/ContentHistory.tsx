import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import StatusBadge from "@/components/StatusBadge";
import { Download, Search, Archive, ArchiveRestore, Trash2, X } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const tabs = [
  { key: "active", label: "Active" },
  { key: "archived", label: "Archived" },
];

export default function ContentHistory() {
  const [search, setSearch] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("htab") || "active";
  const setTab = (tab: string) => { setSearchParams((prev) => { prev.set("htab", tab); return prev; }); setSelected(new Set()); };
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());

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

  const archiveMutation = useMutation({
    mutationFn: async ({ ids, archive }: { ids: string[]; archive: boolean }) => {
      for (const id of ids) {
        const { error } = await supabase.from("content_requests").update({ is_archived: archive } as any).eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["all-requests"] });
      toast.success(vars.ids.length > 1 ? `${vars.ids.length} items ${vars.archive ? "archived" : "restored"}` : vars.archive ? "Content archived" : "Content restored");
      setSelected(new Set());
    },
    onError: () => toast.error("Failed to update content"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        await supabase.from("generated_content").delete().eq("request_id", id);
        await supabase.from("audit_log").delete().eq("request_id", id);
        const { error } = await supabase.from("content_requests").delete().eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ["all-requests"] });
      toast.success(ids.length > 1 ? `${ids.length} items permanently deleted` : "Content permanently deleted");
      setSelected(new Set());
    },
    onError: () => toast.error("Failed to delete content"),
  });

  const activeRequests = requests?.filter((r) => !(r as any).is_archived) || [];
  const archivedRequests = requests?.filter((r) => (r as any).is_archived) || [];

  const filter = (list: typeof activeRequests) =>
    list.filter(
      (r) =>
        r.prompt.toLowerCase().includes(search.toLowerCase()) ||
        r.content_type.includes(search.toLowerCase())
    );

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (items: typeof activeRequests) => {
    const ids = items.map(r => r.id);
    const allSelected = ids.every(id => selected.has(id));
    if (allSelected) {
      setSelected(prev => { const next = new Set(prev); ids.forEach(id => next.delete(id)); return next; });
    } else {
      setSelected(prev => { const next = new Set(prev); ids.forEach(id => next.add(id)); return next; });
    }
  };

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

  const renderBulkBar = (isArchived: boolean) => {
    if (selected.size === 0) return null;
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 border-b border-border">
        <span className="text-sm font-medium">{selected.size} selected</span>
        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setSelected(new Set())}><X className="h-3.5 w-3.5" /></Button>
        <div className="flex-1" />
        {isArchived ? (
          <>
            <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => archiveMutation.mutate({ ids: Array.from(selected), archive: false })} disabled={archiveMutation.isPending}>
              <ArchiveRestore className="h-3.5 w-3.5" /> Restore All
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1 text-xs text-destructive hover:text-destructive border-destructive/30">
                  <Trash2 className="h-3.5 w-3.5" /> Delete All
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {selected.size} items permanently?</AlertDialogTitle>
                  <AlertDialogDescription>This will permanently delete the selected content and all generated versions. This cannot be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteMutation.mutate(Array.from(selected))}>
                    Delete Forever
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        ) : (
          <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => archiveMutation.mutate({ ids: Array.from(selected), archive: true })} disabled={archiveMutation.isPending}>
            <Archive className="h-3.5 w-3.5" /> Archive All
          </Button>
        )}
      </div>
    );
  };

  const renderTable = (list: typeof activeRequests, isArchived: boolean) => {
    const items = filter(list);
    if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
    if (items.length === 0)
      return (
        <div className="p-16 text-center">
          <Archive className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">{isArchived ? "No archived content" : "No content history found."}</p>
        </div>
      );

    const allSelected = items.every(r => selected.has(r.id));

    return (
      <>
        {renderBulkBar(isArchived)}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px]">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 w-10">
                  <Checkbox checked={allSelected} onCheckedChange={() => toggleSelectAll(items)} />
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Date</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Prompt</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Type</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Versions</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Status</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((req) => (
                <tr key={req.id} className={`hover:bg-muted/30 transition-colors ${selected.has(req.id) ? "bg-primary/5" : ""}`}>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <Checkbox checked={selected.has(req.id)} onCheckedChange={() => toggleSelect(req.id)} />
                  </td>
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
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {isArchived ? (
                        <>
                          <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => archiveMutation.mutate({ ids: [req.id], archive: false })} disabled={archiveMutation.isPending}>
                            <ArchiveRestore className="h-3.5 w-3.5" /> Restore
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="gap-1 text-xs text-destructive hover:text-destructive">
                                <Trash2 className="h-3.5 w-3.5" /> Delete
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Permanently delete this content?</AlertDialogTitle>
                                <AlertDialogDescription>This will permanently delete the content request and all generated versions. This action cannot be undone.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteMutation.mutate([req.id])}>
                                  Delete Forever
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      ) : (
                        <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => archiveMutation.mutate({ ids: [req.id], archive: true })} disabled={archiveMutation.isPending}>
                          <Archive className="h-3.5 w-3.5" /> Archive
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" onClick={exportCSV} className="gap-2" size="sm">
          <Download className="h-4 w-4" /> Export Content
        </Button>
        <Button variant="outline" onClick={exportAuditCSV} className="gap-2" size="sm">
          <Download className="h-4 w-4" /> Export Audit Log
        </Button>
      </div>

      <div className="border-b border-border">
        <div className="flex gap-6">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
              {t.key === "active" && activeRequests.length > 0 && (
                <span className="ml-2 text-xs bg-muted px-1.5 py-0.5 rounded-full">{activeRequests.length}</span>
              )}
              {t.key === "archived" && archivedRequests.length > 0 && (
                <span className="ml-2 text-xs bg-muted px-1.5 py-0.5 rounded-full">{archivedRequests.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by prompt or content type..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="glass-card rounded-2xl overflow-hidden shadow-sm">
        {activeTab === "active" && renderTable(activeRequests, false)}
        {activeTab === "archived" && renderTable(archivedRequests, true)}
      </div>
    </div>
  );
}
